"""Print 'x y' (center) of the first UI node whose text or content-desc matches a regex."""
import re
import sys
import xml.etree.ElementTree as ET

path, pattern = sys.argv[1], re.compile(sys.argv[2])
try:
    root = ET.parse(path).getroot()
except Exception:
    sys.exit(1)
for node in root.iter('node'):
    label = (node.get('text') or '') + '\n' + (node.get('content-desc') or '')
    if any(pattern.search(part) for part in label.split('\n') if part):
        m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
        if m:
            x1, y1, x2, y2 = map(int, m.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            sys.exit(0)
sys.exit(1)
