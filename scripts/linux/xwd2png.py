# Converte il framebuffer di Xvfb (-fbdir, formato XWD a 24/32 bit) in PNG, ritagliando x,y,w,h se dati.
import struct, sys, zlib
data = open(sys.argv[1], 'rb').read()
h = struct.unpack('>25I', data[:100])
header_size, width, height, bpp, bpl, ncolors = h[0], h[4], h[5], h[11], h[12], h[19]
off = header_size + ncolors * 12
crop = list(map(int, sys.argv[3].split(','))) if len(sys.argv) > 3 else [0, 0, width, height]
x0, y0, cw, ch = crop
rows = []
for y in range(y0, y0 + ch):
    row = data[off + y * bpl + x0 * 4: off + y * bpl + (x0 + cw) * 4]
    rows.append(b'\x00' + b''.join(bytes((row[i + 2], row[i + 1], row[i])) for i in range(0, len(row), 4)))
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', cw, ch, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows))) + chunk(b'IEND', b'')
open(sys.argv[2], 'wb').write(png)
