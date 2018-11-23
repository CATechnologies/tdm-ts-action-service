#!/usr/bin/env sh
# Copyright © 2018 CA. All rights reserved.  CA Confidential.  Please see License.txt file for applicable usage rights and restrictions.
npm install
npm run-script build
docker build -t tdm/ts-action:1.0 .