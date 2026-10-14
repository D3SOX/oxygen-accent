#!/bin/sh
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: 2026 D3SOX
set -eu
repo_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
data_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}
mkdir -p "$data_dir"
stage_dir=$(mktemp -d "$data_dir/.oxygen-accent-install.XXXXXX")
trap 'rm -rf -- "$stage_dir"' EXIT HUP INT TERM
cp -a "$repo_dir/plasma/oxygen-accent" "$stage_dir/plasma"
cp -a "$repo_dir/icons/oxygen-accent" "$stage_dir/icons"
backup_dir=
for kind in plasma icons; do
    case "$kind" in
        plasma) parent_dir="$data_dir/plasma/desktoptheme" ;;
        icons) parent_dir="$data_dir/icons" ;;
    esac
    mkdir -p "$parent_dir"
    target_dir="$parent_dir/oxygen-accent"
    if [ -e "$target_dir" ] || [ -L "$target_dir" ]; then
        if [ -z "$backup_dir" ]; then
            backup_dir=$(mktemp -d "$data_dir/oxygen-accent-backup.XXXXXX")
        fi
        mv -- "$target_dir" "$backup_dir/$kind"
    fi
    mv -- "$stage_dir/$kind" "$target_dir"
done
printf '%s\n' 'Installed Oxygen Accent. Select it under Plasma Style and Icons in System Settings.'
if [ -n "$backup_dir" ]; then
    printf 'Previous Oxygen Accent copies: %s\n' "$backup_dir"
fi
