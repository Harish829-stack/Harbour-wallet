package main

// QA (db-mig): the real `migrate` binary, run against throwaway databases on the test cluster.
//   T-BE-086: a migration user without CREATEROLE leaves harbour_app missing → exit non-zero, unless HB_ALLOW_MISSING_APP_ROLE=1;
//   T-BE-098: app/service logins are created with their passwords, and no password ever appears in the command's output.
// Needs HB_TEST_POSTGRES_URL with a superuser (to create roles/databases); skipped otherwise.

import (
	"context"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"harbour/backend/internal/testdb"
)

func qaAdmin(t *testing.T) (*pgx.Conn, *url.URL) {
	t.Helper()
	base := os.Getenv("HB_TEST_POSTGRES_URL")
	if base == "" {
		t.Skip("HB_TEST_POSTGRES_URL not set")
	}
	u, _ := url.Parse(base)
	c, err := pgx.Connect(context.Background(), base)
	if err != nil {
		t.Fatal(err)
	}
	var super bool
	if err := c.QueryRow(context.Background(), `SELECT rolsuper FROM pg_roles WHERE rolname=current_user`).Scan(&super); err != nil || !super {
		t.Skip("needs a superuser test connection")
	}
	t.Cleanup(func() { c.Close(context.Background()) })
	return c, u
}

func qaExec(t *testing.T, c *pgx.Conn, sql ...string) {
	t.Helper()
	for _, s := range sql {
		if _, err := c.Exec(context.Background(), s); err != nil {
			t.Fatalf("%s: %v", s, err)
		}
	}
}

func qaBuild(t *testing.T) string {
	t.Helper()
	bin := filepath.Join(t.TempDir(), "migrate")
	out, err := exec.Command("go", "build", "-o", bin, ".").CombinedOutput()
	if err != nil {
		t.Fatalf("build: %v\n%s", err, out)
	}
	return bin
}

func qaRun(t *testing.T, bin, pgURL string, env ...string) (int, string) {
	t.Helper()
	cmd := exec.Command(bin, "-env", filepath.Join(t.TempDir(), "none.env"))
	cmd.Env = append([]string{"PATH=" + os.Getenv("PATH"), "POSTGRES_URL=" + pgURL}, env...)
	out, _ := cmd.CombinedOutput()
	return cmd.ProcessState.ExitCode(), string(out)
}

func TestQAMigrateRequiresAppRoleUnlessAllowed(t *testing.T) {
	admin, u := qaAdmin(t)
	bin := qaBuild(t)
	// harbour_app is cluster-wide and other test packages (running in parallel) create it through their migrations. Wait until no
	// other test process holds the role lock (testdb.RoleLockKey, shared), then keep it exclusive while the role is held aside.
	var got bool
	for deadline := time.Now().Add(10 * time.Minute); ; time.Sleep(500 * time.Millisecond) {
		must(t, admin.QueryRow(context.Background(), `SELECT pg_try_advisory_lock($1)`, testdb.RoleLockKey).Scan(&got))
		if got || time.Now().After(deadline) {
			break
		}
	}
	if !got {
		t.Skip("other test packages kept the role lock for 10 minutes; run this package alone: go test ./cmd/migrate")
	}
	t.Cleanup(func() { _, _ = admin.Exec(context.Background(), `SELECT pg_advisory_unlock($1)`, testdb.RoleLockKey) })
	// harbour_app is cluster-wide: hold it aside so this cluster looks like one where it was never created.
	var exists, held bool
	must(t, admin.QueryRow(context.Background(), `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='harbour_app')`).Scan(&exists))
	// A hold role left by an interrupted earlier run: put it back, or drop it when harbour_app was re-created since.
	must(t, admin.QueryRow(context.Background(), `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='harbour_app_qa_hold')`).Scan(&held))
	if held && exists {
		qaExec(t, admin, `DROP ROLE harbour_app_qa_hold`)
	} else if held {
		qaExec(t, admin, `ALTER ROLE harbour_app_qa_hold RENAME TO harbour_app`)
		exists = true
	}
	if exists {
		qaExec(t, admin, `ALTER ROLE harbour_app RENAME TO harbour_app_qa_hold`)
		t.Cleanup(func() { qaExec(t, admin, `ALTER ROLE harbour_app_qa_hold RENAME TO harbour_app`) })
	}
	qaExec(t, admin, `DROP DATABASE IF EXISTS qa_mig_norole WITH (FORCE)`, `DROP DATABASE IF EXISTS qa_mig_norole2 WITH (FORCE)`, `DROP ROLE IF EXISTS qa_mig`,
		`CREATE ROLE qa_mig LOGIN NOSUPERUSER NOCREATEROLE PASSWORD 'qa-mig-password-123'`,
		`CREATE DATABASE qa_mig_norole OWNER qa_mig`, `CREATE DATABASE qa_mig_norole2 OWNER qa_mig`)
	t.Cleanup(func() {
		qaExec(t, admin, `DROP DATABASE IF EXISTS qa_mig_norole WITH (FORCE)`, `DROP DATABASE IF EXISTS qa_mig_norole2 WITH (FORCE)`, `DROP ROLE IF EXISTS qa_mig`)
	})
	mk := func(db string) string {
		v := *u
		v.User = url.UserPassword("qa_mig", "qa-mig-password-123")
		v.Path = "/" + db
		return v.String()
	}
	code, out := qaRun(t, bin, mk("qa_mig_norole"))
	if code == 0 || !strings.Contains(out, "role harbour_app is missing") {
		t.Fatalf("without CREATEROLE: exit %d, output:\n%s", code, out)
	}
	if strings.Contains(out, "qa-mig-password-123") {
		t.Fatal("the database password appears in the output")
	}
	code, out = qaRun(t, bin, mk("qa_mig_norole2"), "HB_ALLOW_MISSING_APP_ROLE=1")
	if code != 0 || !strings.Contains(out, "services will not get least-privilege grants") {
		t.Fatalf("with HB_ALLOW_MISSING_APP_ROLE=1: exit %d, output:\n%s", code, out)
	}
}

func TestQAMigrateLoginsAndNoPasswordInLogs(t *testing.T) {
	admin, u := qaAdmin(t)
	bin := qaBuild(t)
	const appPW, svcPW, svc2PW = "QA-app-secret-pw-0001", "QA-svc-secret-pw-0002", "QA-svc-secret-pw-0003"
	qaExec(t, admin, `DROP DATABASE IF EXISTS qa_mig_logins WITH (FORCE)`, `CREATE DATABASE qa_mig_logins`)
	t.Cleanup(func() {
		qaExec(t, admin, `DROP DATABASE IF EXISTS qa_mig_logins WITH (FORCE)`)
		for _, r := range []string{"qa_app_login", "qa_svc_one", "qa_svc_two"} {
			_, _ = admin.Exec(context.Background(), `DROP ROLE IF EXISTS `+r)
		}
	})
	v := *u
	v.Path = "/qa_mig_logins"
	code, out := qaRun(t, bin, v.String(), "POSTGRES_APP_USER=qa_app_login", "POSTGRES_APP_PASSWORD="+appPW,
		"POSTGRES_SERVICE_USERS=qa_svc_one:"+svcPW+", qa_svc_two:"+svc2PW)
	if code != 0 {
		t.Fatalf("migrate with logins: exit %d\n%s", code, out)
	}
	for _, pw := range []string{appPW, svcPW, svc2PW} {
		if strings.Contains(out, pw) {
			t.Fatalf("a password appears in the migrate output:\n%s", out)
		}
	}
	// the logins work with exactly those passwords and are members of harbour_app (least privilege)
	for user, pw := range map[string]string{"qa_app_login": appPW, "qa_svc_one": svcPW, "qa_svc_two": svc2PW} {
		w := *u
		w.User = url.UserPassword(user, pw)
		w.Path = "/qa_mig_logins"
		c, err := pgx.Connect(context.Background(), w.String())
		if err != nil {
			t.Fatalf("%s cannot log in: %v", user, err)
		}
		var member, super bool
		must(t, c.QueryRow(context.Background(), `SELECT pg_has_role(current_user, 'harbour_app', 'member'), rolsuper FROM pg_roles WHERE rolname=current_user`).Scan(&member, &super))
		c.Close(context.Background())
		if !member || super {
			t.Fatalf("%s: member of harbour_app=%v superuser=%v", user, member, super)
		}
	}
	// failure paths: a malformed or weak entry dies without echoing the secret
	for _, env := range [][]string{{"POSTGRES_SERVICE_USERS=qa_svc_one" + svcPW}, {"POSTGRES_APP_USER=qa_app_login", "POSTGRES_APP_PASSWORD=short-" + "pw9"}} {
		code, out := qaRun(t, bin, v.String(), env...)
		if code == 0 {
			t.Fatalf("%v accepted", env)
		}
		if strings.Contains(out, svcPW) || strings.Contains(out, "short-pw9") {
			t.Fatalf("a secret appears in the error output for %v:\n%s", env, out)
		}
	}
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
