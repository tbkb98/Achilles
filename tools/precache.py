# Rewrites the FILES list in sw.js from what is on disk. Run after adding or removing files.
import os, re, sys
root = sys.argv[1]
files = []
for d, _, fs in os.walk(root):
    for f in fs:
        p = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
        if p.startswith(('tests/', 'tools/', 'node_modules/', '.git')) or p in ('sw.js', 'package.json', 'README.md', '.nojekyll') or p.endswith('LICENSE.txt'): continue
        files.append(p)
lst = "[\n  './',\n" + ''.join(f"  './{f}',\n" for f in sorted(files)) + ']'
sw = open(os.path.join(root, 'sw.js')).read()
sw = re.sub(r"const FILES = \[.*?\];", lambda m: 'const FILES = ' + lst + ';', sw, flags=re.S)
open(os.path.join(root, 'sw.js'), 'w').write(sw)
print(len(files), 'files precached')
