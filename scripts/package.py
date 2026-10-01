#!/usr/bin/env python3
"""Build a reproducible Chrome Web Store ZIP containing runtime files only."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'manifest.json').read_text())
version = manifest['version']
output = root / 'release-files' / version
output.mkdir(parents=True, exist_ok=True)
files = {
    'manifest.json', 'LICENSE', 'background.js', 'get_text.js',
    'options.html', 'options.css', 'options.js', 'popup.html', 'popup.js',
    'clipboard.html', 'clipboard.js', *manifest['icons'].values(),
    *(str(path.relative_to(root)) for path in (root / 'lib').glob('*.js')),
}
references = {
    manifest['background']['service_worker'], manifest['options_ui']['page'],
    manifest['action']['default_popup'], *manifest['action']['default_icon'].values(),
    *(file for script in manifest['content_scripts'] for file in script['js']),
    *(file for group in manifest['web_accessible_resources'] for file in group['resources']),
}
assert references <= files, f'Missing manifest references: {references - files}'
archive = output / f'middle-click-search-{version}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
    for file in sorted(files):
        info = zipfile.ZipInfo(file, (1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        package.writestr(info, (root / file).read_bytes())
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert set(package.namelist()) == files
    assert json.loads(package.read('manifest.json'))['version'] == version
    for file in files:
        assert package.read(file) == (root / file).read_bytes(), file
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
assets = output / 'store-assets'
if assets.is_dir():
    with zipfile.ZipFile(output / f'chrome-web-store-assets-{version}.zip', 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for file in sorted(assets.iterdir()):
            if not file.is_file():
                continue
            info = zipfile.ZipInfo(file.name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            package.writestr(info, file.read_bytes())
checksums = ''.join(f'{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.name}\n'
                    for file in sorted(output.glob('*.zip')))
(output / 'SHA256SUMS.txt').write_text(checksums)
print(f'{archive}: {len(files)} files, {archive.stat().st_size} bytes')
print(f'SHA256 {checksum}')
