#!/usr/bin/env bash
# Prints the value of $1 from .env, without inline comments or trailing spaces.
[[ -f .env ]] || exit 0
grep -E "^$1=" .env | head -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//'
