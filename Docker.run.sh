#!/usr/bin/env sh
# Copyright © 2018 CA. All rights reserved.  CA Confidential.  Please see License.txt file for applicable usage rights and restrictions.
docker run --rm -it --network tdmweb --hostname ts-action --name ts-action -e ACTION_SECRET=123 -p 8080:8080 -p 8443:8443 \
 tdm/ts-action:1.0
