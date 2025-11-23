#!/usr/bin/env python3
"""
Python License Scanner - Native Python implementation
Scans installed packages and extracts license information using importlib.metadata

This script is called by Node.js and returns JSON output.
Handles all worst-case scenarios:
1. Python version compatibility (3.7+)
2. Read-only filesystems (runs via python -c)
3. Encoding issues (force UTF-8)
4. Virtualenv detection
"""

import sys
import json
import os

# MITIGATION #3: Force UTF-8 encoding (Windows CP1252 fix)
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

# MITIGATION #1: Python version compatibility
# Try importlib.metadata (Python 3.8+), fallback to pkg_resources (Python 3.7)
try:
    import importlib.metadata as metadata
    USING_IMPORTLIB = True
except ImportError:
    try:
        import pkg_resources
        USING_IMPORTLIB = False
    except ImportError:
        print(json.dumps({"error": "Neither importlib.metadata nor pkg_resources available"}), file=sys.stderr)
        sys.exit(1)


def extract_license_from_classifier(classifier):
    """
    Extract license name from Trove Classifier
    Example: "License :: OSI Approved :: MIT License" -> "MIT License"
    """
    parts = classifier.split(' :: ')
    last = parts[-1].strip()
    return last if last != 'OSI Approved' else None


def get_license_via_importlib(package_name):
    """
    Get license using importlib.metadata (Python 3.8+)
    Implements pip-licenses priority: License-Expression > Classifier > License
    """
    try:
        dist = metadata.distribution(package_name)

        # Priority 1: License-Expression (PEP 639 - modern packages)
        license_expr = dist.metadata.get('License-Expression')
        if license_expr and license_expr.strip() and license_expr.strip().lower() != 'none':
            return license_expr.strip()

        # Priority 2: Trove Classifiers
        classifiers = dist.metadata.get_all('Classifier') or []
        license_classifiers = [c for c in classifiers if c.startswith('License ::')]
        if license_classifiers:
            license_from_classifier = extract_license_from_classifier(license_classifiers[0])
            if license_from_classifier:
                return license_from_classifier

        # Priority 3: License field (legacy)
        license_field = dist.metadata.get('License')
        if license_field and license_field.strip() and license_field.strip().lower() != 'none':
            return license_field.strip()

        return 'UNKNOWN'

    except Exception:
        return 'UNKNOWN'


def get_license_via_pkg_resources(package_name):
    """
    Get license using pkg_resources (Python 3.7 fallback)
    """
    try:
        dist = pkg_resources.get_distribution(package_name)

        if dist.has_metadata('METADATA'):
            metadata_content = dist.get_metadata('METADATA')
            lines = metadata_content.split('\n')

            license_expr = None
            license_field = None
            classifiers = []

            for line in lines:
                if line.startswith('License-Expression:'):
                    license_expr = line.split(':', 1)[1].strip()
                elif line.startswith('License:'):
                    license_field = line.split(':', 1)[1].strip()
                elif line.startswith('Classifier:') and 'License ::' in line:
                    classifiers.append(line.split(':', 1)[1].strip())

            # Priority: License-Expression > Classifier > License
            if license_expr and license_expr.lower() != 'none':
                return license_expr

            if classifiers:
                license_from_classifier = extract_license_from_classifier(classifiers[0])
                if license_from_classifier:
                    return license_from_classifier

            if license_field and license_field.lower() != 'none':
                return license_field

        return 'UNKNOWN'

    except Exception:
        return 'UNKNOWN'


def scan_packages(package_names):
    """
    Scan licenses for a list of packages
    Returns: dict {package_name: license_string}
    """
    results = {}
    get_license = get_license_via_importlib if USING_IMPORTLIB else get_license_via_pkg_resources

    for pkg in package_names:
        # Try exact name first
        license_info = get_license(pkg)

        # If UNKNOWN, try with normalized name (dashes to underscores)
        if license_info == 'UNKNOWN' and '-' in pkg:
            normalized = pkg.replace('-', '_')
            license_info = get_license(normalized)

        # If still UNKNOWN, try with underscores to dashes
        if license_info == 'UNKNOWN' and '_' in pkg:
            normalized = pkg.replace('_', '-')
            license_info = get_license(normalized)

        results[pkg.lower()] = license_info

    return results


def main():
    """
    Main entry point
    Expects: JSON array of package names via stdin
    Returns: JSON object {package: license} via stdout
    """
    try:
        # Read package list from stdin
        input_data = sys.stdin.read()
        package_names = json.loads(input_data)

        if not isinstance(package_names, list):
            raise ValueError("Expected JSON array of package names")

        # Scan licenses
        results = scan_packages(package_names)

        # Output JSON to stdout
        print(json.dumps(results, ensure_ascii=False))

    except Exception as e:
        error_output = {"error": str(e)}
        print(json.dumps(error_output), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
