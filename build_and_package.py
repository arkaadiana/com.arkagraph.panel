import os
import re
import shutil
import zipfile

root_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(root_dir, 'src')
dist_dir = os.path.join(root_dir, 'dist')

print("Starting Python build process (no Node required)...")

# 1. Create dist directory
if not os.path.exists(dist_dir):
    os.makedirs(dist_dir)

# 2. Read src/index.html
html_path = os.path.join(src_dir, 'index.html')
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 3. Find all script tags and concatenate JS files
script_regex = re.compile(r'<script\s+src="([^"]+)"></script>')
combined_js = ""
matches = script_regex.findall(html)

print(f"Found {len(matches)} JavaScript files to combine.")

for js_file in matches:
    js_path = os.path.join(src_dir, js_file)
    if os.path.exists(js_path):
        with open(js_path, 'r', encoding='utf-8') as f:
            combined_js += f.read() + "\n"
    else:
        print(f"Warning: File not found: {js_path}")

# Write to dist/bundle.js (unobfuscated for debugging & flexibility)
bundle_path = os.path.join(dist_dir, 'bundle.js')
with open(bundle_path, 'w', encoding='utf-8') as f:
    f.write(combined_js)
print("Created dist/bundle.js")

# 4. Generate clean dist/index.html
clean_html = script_regex.sub('', html)
# Make sure we don't have trailing empty lines in header/body
clean_html = re.sub(r'\n\s*\n', '\n', clean_html)
clean_html = clean_html.replace('</body>', '    <script src="bundle.js"></script>\n</body>')

with open(os.path.join(dist_dir, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(clean_html)
print("Created dist/index.html")

# 5. Copy styles.css to dist/
shutil.copyfile(os.path.join(src_dir, 'styles.css'), os.path.join(dist_dir, 'styles.css'))
print("Copied styles.css to dist/")

# 6. Create ZXP file (ZIP format)
zxp_filename = os.path.join(root_dir, 'ArkaGraph_v2.0.3-beta.zxp')
print(f"Packaging extension into {zxp_filename}...")

# Files/folders to include in ZXP
includes = [
    ('CSXS', 'CSXS'),
    ('dist', 'dist'),
    ('host', 'host'),
    ('mimetype', 'mimetype')
]

with zipfile.ZipFile(zxp_filename, 'w', zipfile.ZIP_DEFLATED) as zxp:
    for item_name, arc_name in includes:
        full_path = os.path.join(root_dir, item_name)
        if os.path.isdir(full_path):
            for root, dirs, files in os.walk(full_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, root_dir)
                    zxp.write(file_path, rel_path)
        elif os.path.exists(full_path):
            zxp.write(full_path, item_name)

print("BUILD AND PACKAGING SUCCESSFUL!")
print(f"Generated ZXP file: {zxp_filename}")
