#!/bin/sh
set -eux
tsc
sed -i 's/export {};//g' out/*.js
