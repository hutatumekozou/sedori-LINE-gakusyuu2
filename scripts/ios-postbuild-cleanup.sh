#!/bin/bash

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PROJ_ROOT="/Users/kukkiiboy/Desktop/Claudecode/8月4日O3XcodeTrans/jiji-quiz-2025-2/JijiQuiz2025"
PROJ_ROOT="${PROJ_ROOT:-$DEFAULT_PROJ_ROOT}"
REPORT="${REPORT:-$HOME/Desktop/_PostBuildCleanup_$(date +%Y%m%d_%H%M%S).txt}"

KEEP_ARCHIVES_PER_APP="${KEEP_ARCHIVES_PER_APP:-1}"
KEEP_IPA_DIRS="${KEEP_IPA_DIRS:-1}"
TARGET_IOS_MAJOR="${TARGET_IOS_MAJOR:-18}"

DRY_RUN="${DRY_RUN:-true}"
CLEAN_OLD_DEVICESUPPORT="${CLEAN_OLD_DEVICESUPPORT:-false}"
CLEAN_SIMULATOR_HARD="${CLEAN_SIMULATOR_HARD:-false}"
CLEAN_PM_CACHES="${CLEAN_PM_CACHES:-true}"
CLEAN_OS_UPDATE_SNAPSHOTS="${CLEAN_OS_UPDATE_SNAPSHOTS:-false}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ios_postbuild_cleanup.XXXXXX")"
SKIP_LOG="$TMP_DIR/skipped.log"
KEEP_LOG="$TMP_DIR/kept.log"
touch "$SKIP_LOG" "$KEEP_LOG"

cleanup_tmp() {
  rm -rf -- "$TMP_DIR"
}
trap cleanup_tmp EXIT

before_avail_kb=0
after_avail_kb=0
total_candidate_kb=0
total_deleted_kb=0

is_true() {
  case "${1:-false}" in
    true|TRUE|1|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

report_line() {
  printf '%s\n' "$*" >> "$REPORT"
}

report_section() {
  report_line ""
  report_line "=== $* ==="
}

human_kb() {
  local kb="${1:-0}"
  awk -v kb="$kb" 'BEGIN {
    gb = kb / 1048576;
    mb = kb / 1024;
    if (gb >= 1) {
      printf "%.2f GB", gb;
    } else {
      printf "%.2f MB", mb;
    }
  }'
}

df_avail_kb() {
  df -Pk / | awk 'NR==2 {print $4}'
}

du_kb() {
  local path="$1"
  if [[ ! -e "$path" ]]; then
    echo 0
    return 0
  fi

  du -sk "$path" 2>/dev/null | awk '{sum += $1} END {print sum + 0}'
}

record_skip() {
  local reason="$1"
  printf '%s\n' "$reason" >> "$SKIP_LOG"
}

record_keep() {
  local note="$1"
  printf '%s\n' "$note" >> "$KEEP_LOG"
}

add_candidate_kb() {
  local kb="${1:-0}"
  total_candidate_kb=$((total_candidate_kb + kb))
}

add_deleted_kb() {
  local kb="${1:-0}"
  total_deleted_kb=$((total_deleted_kb + kb))
}

remove_path() {
  local section="$1"
  local label="$2"
  local path="$3"
  local size_kb=0

  if [[ ! -e "$path" ]]; then
    record_skip "$section | $label | missing | $path"
    return 0
  fi

  size_kb="$(du_kb "$path")"
  add_candidate_kb "$size_kb"

  if is_true "$DRY_RUN"; then
    report_line "[dry-run] $section | $label | $(human_kb "$size_kb") | $path"
    return 0
  fi

  if rm -rf -- "$path" 2>/dev/null; then
    add_deleted_kb "$size_kb"
    report_line "[deleted] $section | $label | $(human_kb "$size_kb") | $path"
    return 0
  fi

  report_line "[skipped] $section | $label | $(human_kb "$size_kb") | $path"
  record_skip "$section | $label | remove failed or permission denied | $path"
  return 0
}

run_command_cleanup() {
  local section="$1"
  local label="$2"
  local dry_run_cmd="$3"
  local real_cmd="$4"
  local estimate_note="${5:-size estimate unavailable}"
  local output_file="$TMP_DIR/command_output.txt"

  : > "$output_file"

  if is_true "$DRY_RUN"; then
    if [[ -n "$dry_run_cmd" ]]; then
      if bash -lc "$dry_run_cmd" >"$output_file" 2>&1; then
        report_line "[dry-run] $section | $label | $estimate_note"
        if [[ -s "$output_file" ]]; then
          sed 's/^/  /' "$output_file" >> "$REPORT"
        fi
      else
        report_line "[skipped] $section | $label | dry-run inspection failed"
        if [[ -s "$output_file" ]]; then
          sed 's/^/  /' "$output_file" >> "$REPORT"
        fi
      fi
    else
      report_line "[dry-run] $section | $label | $estimate_note"
    fi
    return 0
  fi

  if bash -lc "$real_cmd" >"$output_file" 2>&1; then
    report_line "[executed] $section | $label | exact reclaimed size tracked via disk delta"
    if [[ -s "$output_file" ]]; then
      sed 's/^/  /' "$output_file" >> "$REPORT"
    fi
    return 0
  fi

  report_line "[skipped] $section | $label | command failed"
  if [[ -s "$output_file" ]]; then
    sed 's/^/  /' "$output_file" >> "$REPORT"
  fi
  record_skip "$section | $label | command failed"
  return 0
}

run_command_cleanup_with_cache_path() {
  local section="$1"
  local label="$2"
  local cache_path="$3"
  local cmd="$4"
  local before_kb=0
  local after_kb=0
  local output_file="$TMP_DIR/command_output.txt"

  before_kb="$(du_kb "$cache_path")"
  add_candidate_kb "$before_kb"

  if is_true "$DRY_RUN"; then
    report_line "[dry-run] $section | $label | $(human_kb "$before_kb") | $cache_path"
    return 0
  fi

  : > "$output_file"
  if bash -lc "$cmd" >"$output_file" 2>&1; then
    after_kb="$(du_kb "$cache_path")"
    if (( before_kb > after_kb )); then
      add_deleted_kb $((before_kb - after_kb))
    fi
    report_line "[executed] $section | $label | before $(human_kb "$before_kb"), after $(human_kb "$after_kb") | $cache_path"
    if [[ -s "$output_file" ]]; then
      sed 's/^/  /' "$output_file" >> "$REPORT"
    fi
    return 0
  fi

  report_line "[skipped] $section | $label | command failed | $cache_path"
  if [[ -s "$output_file" ]]; then
    sed 's/^/  /' "$output_file" >> "$REPORT"
  fi
  record_skip "$section | $label | command failed | $cache_path"
  return 0
}

snapshot_df() {
  local title="$1"
  report_section "$title"
  df -h / >> "$REPORT" 2>&1
}

prune_archives() {
  local archives_root="$HOME/Library/Developer/Xcode/Archives"
  local list_file="$TMP_DIR/archives.tsv"
  local sorted_file="$TMP_DIR/archives.sorted.tsv"
  local current_app=""
  local keep_count=0

  report_section "Archives"

  if [[ ! -d "$archives_root" ]]; then
    report_line "Archives root not found: $archives_root"
    return 0
  fi

  : > "$list_file"

  while IFS= read -r -d '' archive_path; do
    local archive_name app_name mtime
    archive_name="$(basename "$archive_path" .xcarchive)"
    app_name="$(printf '%s\n' "$archive_name" | sed -E 's/ [0-9]{4}-[0-9]{2}-[0-9]{2}.*$//')"
    if [[ -z "$app_name" ]]; then
      app_name="$archive_name"
    fi
    mtime="$(stat -f '%m' "$archive_path" 2>/dev/null || echo 0)"
    printf '%s\t%s\t%s\n' "$app_name" "$mtime" "$archive_path" >> "$list_file"
  done < <(find "$archives_root" -type d -name '*.xcarchive' -print0 2>/dev/null)

  if [[ ! -s "$list_file" ]]; then
    report_line "No xcarchive entries found."
    return 0
  fi

  LC_ALL=C sort -t '	' -k1,1 -k2,2nr "$list_file" > "$sorted_file"

  while IFS='	' read -r app_name mtime archive_path; do
    if [[ "$app_name" != "$current_app" ]]; then
      current_app="$app_name"
      keep_count=0
    fi

    keep_count=$((keep_count + 1))

    if (( keep_count <= KEEP_ARCHIVES_PER_APP )); then
      record_keep "Archives | keep latest for app=$app_name | $archive_path"
      report_line "[keep] Archives | $app_name | latest #$keep_count | $archive_path"
    else
      remove_path "Archives" "old archive for $app_name" "$archive_path"
    fi
  done < "$sorted_file"

  while IFS= read -r -d '' date_dir; do
    if [[ -z "$(find "$date_dir" -mindepth 1 -print -quit 2>/dev/null)" ]]; then
      remove_path "Archives" "empty archive date folder" "$date_dir"
    fi
  done < <(find "$archives_root" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
}

find_project_artifact_dirs() {
  local root="$1"
  find "$root" \
    \( -name '.git' -o -name 'node_modules' -o -name 'Pods' -o -name '.build' -o -name 'DerivedData' \) -prune -o \
    -type d \( -name 'ipa' -o -name 'ipa_output' -o -name '*.xcarchive' -o -iname '*archive*' \) -print0 2>/dev/null
}

is_safe_project_artifact_dir() {
  local dir="$1"
  local base lower_base

  base="$(basename "$dir")"
  lower_base="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')"

  if [[ "$lower_base" == "ipa" || "$lower_base" == "ipa_output" || "$lower_base" == *.xcarchive ]]; then
    return 0
  fi

  if [[ "$lower_base" == *archive* ]]; then
    if find "$dir" -maxdepth 2 \( -name '*.ipa' -o -name '*.xcarchive' -o -name 'DistributionSummary.plist' \) -print -quit 2>/dev/null | grep -q .; then
      return 0
    fi
  fi

  return 1
}

has_safe_artifact_ancestor() {
  local dir="$1"
  local parent

  parent="$(dirname "$dir")"
  while [[ "$parent" != "$PROJ_ROOT" && "$parent" != "/" && "$parent" != "." ]]; do
    if is_safe_project_artifact_dir "$parent"; then
      return 0
    fi
    parent="$(dirname "$parent")"
  done

  return 1
}

prune_project_outputs() {
  local list_file="$TMP_DIR/project_artifacts.tsv"
  local sorted_file="$TMP_DIR/project_artifacts.sorted.tsv"
  local keep_index=0

  report_section "Project Output Directories"
  report_line "Project root: $PROJ_ROOT"

  if [[ ! -d "$PROJ_ROOT" ]]; then
    report_line "Project root not found."
    record_skip "Project Output Directories | missing project root | $PROJ_ROOT"
    return 0
  fi

  : > "$list_file"

  while IFS= read -r -d '' dir; do
    local mtime
    if ! is_safe_project_artifact_dir "$dir"; then
      continue
    fi
    if has_safe_artifact_ancestor "$dir"; then
      continue
    fi

    mtime="$(stat -f '%m' "$dir" 2>/dev/null || echo 0)"
    printf '%s\t%s\n' "$mtime" "$dir" >> "$list_file"
  done < <(find_project_artifact_dirs "$PROJ_ROOT")

  if [[ ! -s "$list_file" ]]; then
    report_line "No matching generated artifact directories found."
    return 0
  fi

  LC_ALL=C sort -t '	' -k1,1nr "$list_file" > "$sorted_file"

  while IFS='	' read -r mtime dir; do
    keep_index=$((keep_index + 1))
    if (( keep_index <= KEEP_IPA_DIRS )); then
      record_keep "Project Output Directories | keep latest #$keep_index | $dir"
      report_line "[keep] Project Output Directories | latest #$keep_index | $dir"
    else
      remove_path "Project Output Directories" "old generated output directory" "$dir"
    fi
  done < "$sorted_file"
}

clean_xcode_artifacts() {
  report_section "Xcode Derived Data and Caches"

  remove_path "Xcode" "DerivedData" "$HOME/Library/Developer/Xcode/DerivedData"
  remove_path "SwiftPM" "org.swift.swiftpm cache" "$HOME/Library/Caches/org.swift.swiftpm"
  remove_path "SwiftPM" "user swiftpm cache" "$HOME/.swiftpm"

  local xcode_cache
  for xcode_cache in "$HOME"/Library/Caches/com.apple.dt.Xcode*; do
    if [[ -e "$xcode_cache" ]]; then
      remove_path "Xcode" "Xcode cache" "$xcode_cache"
    fi
  done

  run_command_cleanup \
    "Simulator" \
    "delete unavailable simulators" \
    "xcrun simctl list devices unavailable" \
    "xcrun simctl delete unavailable" \
    "size estimate unavailable"
}

clean_package_manager_caches() {
  local npm_cache_dir=""
  local yarn_cache_dir=""

  report_section "Package Manager Caches"

  if ! is_true "$CLEAN_PM_CACHES"; then
    report_line "Skipped because CLEAN_PM_CACHES=false"
    return 0
  fi

  if command -v npm >/dev/null 2>&1; then
    npm_cache_dir="$(npm config get cache 2>/dev/null || true)"
    if [[ -n "$npm_cache_dir" && -d "$npm_cache_dir" ]]; then
      run_command_cleanup_with_cache_path "npm" "npm cache clean --force" "$npm_cache_dir" "npm cache clean --force"
    else
      report_line "[skipped] npm | cache path unavailable"
    fi
  else
    report_line "[skipped] npm | command not found"
  fi

  if command -v yarn >/dev/null 2>&1; then
    yarn_cache_dir="$(yarn cache dir 2>/dev/null || true)"
    if [[ -n "$yarn_cache_dir" && -d "$yarn_cache_dir" ]]; then
      run_command_cleanup_with_cache_path "yarn" "yarn cache clean" "$yarn_cache_dir" "yarn cache clean"
    else
      report_line "[skipped] yarn | cache path unavailable"
    fi
  else
    report_line "[skipped] yarn | command not found"
  fi

  remove_path "pip" "pip cache" "$HOME/Library/Caches/pip"
  remove_path "pip" "user pip cache" "$HOME/.cache/pip"

  if command -v brew >/dev/null 2>&1; then
    run_command_cleanup_with_cache_path "Homebrew" "brew cleanup -s && brew autoremove" "$HOME/Library/Caches/Homebrew" "brew cleanup -s && brew autoremove"
  else
    report_line "[skipped] Homebrew | command not found"
  fi
}

clean_old_device_support() {
  local device_support_root="/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/DeviceSupport"

  report_section "Old DeviceSupport"

  if ! is_true "$CLEAN_OLD_DEVICESUPPORT"; then
    report_line "Skipped because CLEAN_OLD_DEVICESUPPORT=false"
    return 0
  fi

  if [[ ! -d "$device_support_root" ]]; then
    report_line "DeviceSupport root not found: $device_support_root"
    return 0
  fi

  while IFS= read -r -d '' dir; do
    local base
    base="$(basename "$dir")"
    case "$base" in
      "${TARGET_IOS_MAJOR}"*|Latest)
        record_keep "Old DeviceSupport | keep | $dir"
        report_line "[keep] Old DeviceSupport | $dir"
        ;;
      [0-9]*)
        remove_path "Old DeviceSupport" "non-target iOS version" "$dir"
        ;;
      *)
        record_keep "Old DeviceSupport | keep non-version entry | $dir"
        report_line "[keep] Old DeviceSupport | non-version entry | $dir"
        ;;
    esac
  done < <(find "$device_support_root" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
}

clean_simulator_hard() {
  local runtimes_root="/Library/Developer/CoreSimulator/Profiles/Runtimes"

  report_section "Simulator Hard Cleanup"

  if ! is_true "$CLEAN_SIMULATOR_HARD"; then
    report_line "Skipped because CLEAN_SIMULATOR_HARD=false"
    return 0
  fi

  while IFS= read -r -d '' dir; do
    remove_path "Simulator Hard Cleanup" "device cache/tmp/logs" "$dir"
  done < <(find "$HOME/Library/Developer/CoreSimulator/Devices" -type d \( -path '*/data/Library/Caches' -o -path '*/data/tmp' -o -path '*/data/Library/Logs' \) -print0 2>/dev/null)

  if [[ ! -d "$runtimes_root" ]]; then
    report_line "Simulator runtimes root not found: $runtimes_root"
    return 0
  fi

  while IFS= read -r -d '' runtime; do
    local base
    base="$(basename "$runtime")"
    case "$base" in
      iOS\ "${TARGET_IOS_MAJOR}"*.simruntime)
        record_keep "Simulator Hard Cleanup | keep target runtime | $runtime"
        report_line "[keep] Simulator Hard Cleanup | target runtime | $runtime"
        ;;
      iOS\ *.simruntime)
        remove_path "Simulator Hard Cleanup" "old iOS simulator runtime" "$runtime"
        ;;
      *)
        record_keep "Simulator Hard Cleanup | keep non-iOS runtime | $runtime"
        report_line "[keep] Simulator Hard Cleanup | non-iOS runtime | $runtime"
        ;;
    esac
  done < <(find "$runtimes_root" -mindepth 1 -maxdepth 1 \( -type d -o -type f \) -print0 2>/dev/null)
}

clean_os_update_snapshots() {
  local snapshot_file="$TMP_DIR/os_update_snapshots.txt"
  local snapshot_names_file="$TMP_DIR/os_update_snapshot_names.txt"
  local output_file="$TMP_DIR/command_output.txt"

  report_section "OS Update Snapshots"

  if ! is_true "$CLEAN_OS_UPDATE_SNAPSHOTS"; then
    report_line "Skipped because CLEAN_OS_UPDATE_SNAPSHOTS=false"
    return 0
  fi

  if ! command -v diskutil >/dev/null 2>&1; then
    report_line "[skipped] OS Update Snapshots | diskutil not found"
    return 0
  fi

  if ! diskutil apfs listSnapshots / >"$snapshot_file" 2>&1; then
    report_line "[skipped] OS Update Snapshots | failed to list snapshots"
    sed 's/^/  /' "$snapshot_file" >> "$REPORT"
    record_skip "OS Update Snapshots | diskutil apfs listSnapshots failed"
    return 0
  fi

  grep 'com\.apple\.os\.update-' "$snapshot_file" | sed -E 's/.*Name:[[:space:]]+//' > "$snapshot_names_file" || true

  if [[ ! -s "$snapshot_names_file" ]]; then
    report_line "No com.apple.os.update-* snapshots found."
    return 0
  fi

  report_line "Snapshots selected for cleanup:"
  sed 's/^/  /' "$snapshot_names_file" >> "$REPORT"
  report_line "Total size: diskutil does not expose a stable per-snapshot size here, so refer to before/after disk delta."

  if is_true "$DRY_RUN"; then
    report_line "[dry-run] OS Update Snapshots | review-only"
    return 0
  fi

  if [[ -t 0 ]]; then
    printf 'APFS update snapshots listed in %s\n' "$REPORT"
    printf 'Press Enter to delete the listed snapshots, or Ctrl-C to abort: '
    read -r _
  else
    report_line "[skipped] OS Update Snapshots | interactive confirmation unavailable"
    record_skip "OS Update Snapshots | interactive confirmation unavailable"
    return 0
  fi

  while IFS= read -r snapshot_name; do
    : > "$output_file"
    if sudo diskutil apfs deleteSnapshot / -name "$snapshot_name" >"$output_file" 2>&1; then
      report_line "[executed] OS Update Snapshots | deleted | $snapshot_name"
      sed 's/^/  /' "$output_file" >> "$REPORT"
    else
      report_line "[skipped] OS Update Snapshots | delete failed | $snapshot_name"
      sed 's/^/  /' "$output_file" >> "$REPORT"
      record_skip "OS Update Snapshots | delete failed | $snapshot_name"
    fi
  done < "$snapshot_names_file"

  : > "$output_file"
  if sudo softwareupdate --cleanup >"$output_file" 2>&1; then
    report_line "[executed] OS Update Snapshots | softwareupdate --cleanup"
    sed 's/^/  /' "$output_file" >> "$REPORT"
  else
    report_line "[skipped] OS Update Snapshots | softwareupdate --cleanup failed"
    sed 's/^/  /' "$output_file" >> "$REPORT"
    record_skip "OS Update Snapshots | softwareupdate cleanup failed"
  fi

  while IFS= read -r -d '' updates_item; do
    remove_path "OS Update Snapshots" "Library/Updates residue" "$updates_item"
  done < <(find "/Library/Updates" -mindepth 1 -maxdepth 1 -print0 2>/dev/null)
}

write_summary() {
  after_avail_kb="$(df_avail_kb)"

  snapshot_df "After Disk Snapshot"

  report_section "Summary"
  report_line "Mode: $(is_true "$DRY_RUN" && printf 'DRY_RUN' || printf 'LIVE')"
  report_line "Project root: $PROJ_ROOT"
  report_line "Report path: $REPORT"
  report_line "Keep archives per app: $KEEP_ARCHIVES_PER_APP"
  report_line "Keep project output dirs: $KEEP_IPA_DIRS"
  report_line "Target iOS major to keep: $TARGET_IOS_MAJOR"
  report_line "Candidate total (path-sized items): $(human_kb "$total_candidate_kb")"
  report_line "Deleted total (path-sized items): $(human_kb "$total_deleted_kb")"
  report_line "Disk free delta: $(human_kb $((after_avail_kb - before_avail_kb)))"
  report_line "Note: command-based cleanup such as simctl/brew may reclaim additional space that is only reflected in Disk free delta."

  report_section "Kept Items"
  if [[ -s "$KEEP_LOG" ]]; then
    cat "$KEEP_LOG" >> "$REPORT"
  else
    report_line "No kept-item entries recorded."
  fi

  report_section "Skipped Items"
  if [[ -s "$SKIP_LOG" ]]; then
    cat "$SKIP_LOG" >> "$REPORT"
  else
    report_line "No skipped items."
  fi
}

main() {
  mkdir -p "$(dirname "$REPORT")"

  cat > "$REPORT" <<EOF
iOS Post-Build Cleanup Report
Generated at: $(date '+%Y-%m-%d %H:%M:%S %Z %z')
Host: $(hostname)
EOF

  report_section "Configuration"
  report_line "PROJ_ROOT=$PROJ_ROOT"
  report_line "REPORT=$REPORT"
  report_line "KEEP_ARCHIVES_PER_APP=$KEEP_ARCHIVES_PER_APP"
  report_line "KEEP_IPA_DIRS=$KEEP_IPA_DIRS"
  report_line "TARGET_IOS_MAJOR=$TARGET_IOS_MAJOR"
  report_line "DRY_RUN=$DRY_RUN"
  report_line "CLEAN_OLD_DEVICESUPPORT=$CLEAN_OLD_DEVICESUPPORT"
  report_line "CLEAN_SIMULATOR_HARD=$CLEAN_SIMULATOR_HARD"
  report_line "CLEAN_PM_CACHES=$CLEAN_PM_CACHES"
  report_line "CLEAN_OS_UPDATE_SNAPSHOTS=$CLEAN_OS_UPDATE_SNAPSHOTS"

  before_avail_kb="$(df_avail_kb)"
  snapshot_df "Before Disk Snapshot"

  clean_xcode_artifacts
  prune_archives
  prune_project_outputs
  clean_package_manager_caches
  clean_old_device_support
  clean_simulator_hard
  clean_os_update_snapshots
  write_summary

  open "$REPORT" >/dev/null 2>&1 || true
  printf 'Report written to %s\n' "$REPORT"
}

main "$@"
