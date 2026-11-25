package notifier

import (
	"fmt"
	"os"
)

func fmtAny(v any) string { return fmt.Sprint(v) }
func strictQA() bool      { return os.Getenv("HB_QA_STRICT") == "1" }
