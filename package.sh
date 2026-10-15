#!/bin/sh
# SPDX-License-Identifier: MIT
# SPDX-FileCopyrightText: 2026 D3SOX
set -eu
repo_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
version=$(sed -n 's/^[[:space:]]*"Version":[[:space:]]*"\([^"]*\)".*/\1/p' "$repo_dir/plasma/oxygen-accent/metadata.json")
[ -n "$version" ] || { printf '%s\n' 'Missing theme version.' >&2; exit 1; }
if ! printf '%s\n' "$version" | LC_ALL=C grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+-[1-9][0-9]*$'; then
    printf '%s\n' 'Expected an Oxygen version and fork revision, for example 6.8.0-1.' >&2
    exit 1
fi
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "v$version" ]; }; then
    printf 'Release tag must be v%s.\n' "$version" >&2
    exit 1
fi
output_dir="$repo_dir/dist"
mkdir -p "$output_dir"
stage_dir=$(mktemp -d)
trap 'rm -rf -- "$stage_dir"' EXIT HUP INT TERM
for kind in plasma icons; do
    mkdir -p "$stage_dir/$kind"
    cp -a "$repo_dir/$kind/oxygen-accent" "$stage_dir/$kind/oxygen-accent"
    theme_dir="$stage_dir/$kind/oxygen-accent"
    mkdir -p "$theme_dir/LICENSES"
    cp "$repo_dir/LICENSES/GPL-3.0-or-later.txt" "$repo_dir/LICENSES/CC0-1.0.txt" "$theme_dir/LICENSES/"
    if [ "$kind" = plasma ]; then
        license=GPL-3.0-or-later
        install_path='.local/share/plasma/desktoptheme/ in your home directory'
        settings_page='Plasma Style'
        requirement='Requires KDE Plasma 6.8 or newer.'
    else
        license=LGPL-3.0-or-later
        install_path='.local/share/icons/ in your home directory'
        settings_page='Icons'
        requirement='Requires the original Oxygen icon theme. On Arch Linux, install oxygen-icons.'
        cp "$repo_dir/LICENSES/LGPL-3.0-or-later.txt" "$theme_dir/LICENSES/"
    fi
    cat > "$theme_dir/README" <<EOF
Oxygen Accent $version

$requirement

Install through System Settings under $settings_page, or extract the oxygen-accent folder into $install_path. Select Oxygen Accent and choose your accent under Colors.

The Oxygen Project and KDE created the original artwork. D3SOX added the accent support. The artwork uses $license. See LICENSES and REUSE.toml for the terms and copyright notices.

Source and documentation: https://github.com/D3SOX/oxygen-accent
Original Plasma artwork: https://invent.kde.org/plasma/oxygen
Original icon artwork: https://invent.kde.org/frameworks/oxygen-icons
EOF
    cat > "$theme_dir/REUSE.toml" <<EOF
version = 1

[[annotations]]
path = ["**"]
precedence = "aggregate"
SPDX-FileCopyrightText = [
    "The Oxygen Project <kde-artists@kde.org>",
    "2007 Nuno Pinheiro <nuno@oxygen-icons.org>",
    "2007 David Vignoni <david@icon-king.com>",
    "2007 David Miller <miller@oxygen-icons.org>",
    "2007 Johann Ollivier Lapeyre <johann@oxygen-icons.org>",
    "2007 Kenneth Wimer <kwwii@bootsplash.org>",
    "2007 Riccardo Iaconelli <riccardo@oxygen-icons.org>",
    "2026 D3SOX"
]
SPDX-License-Identifier = "$license"

[[annotations]]
path = ["README", "REUSE.toml"]
precedence = "override"
SPDX-FileCopyrightText = "2026 D3SOX"
SPDX-License-Identifier = "CC0-1.0"
EOF
    archive="$output_dir/oxygen-accent-$kind.tar.gz"
    tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -czf "$archive" -C "$stage_dir/$kind" oxygen-accent
    printf '%s\n' "$archive"
done
