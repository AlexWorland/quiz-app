#!/bin/bash
set -e
cd "$(dirname "$0")/../../backend"
exec cargo run

