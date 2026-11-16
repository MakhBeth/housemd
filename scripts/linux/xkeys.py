# Preme tasti e clic nel server X con XTest (solo ctypes, niente xdotool), per scripts/linux/open-with-check.mjs.
import ctypes, sys, time
x11 = ctypes.cdll.LoadLibrary('libX11.so.6')
xtst = ctypes.cdll.LoadLibrary('libXtst.so.6')
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
x11.XFlush.argtypes = [ctypes.c_void_p]
d = x11.XOpenDisplay(None)
xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
xtst.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
for name in sys.argv[1:]:
    if name.startswith('move:'):
        x, y = map(int, name[5:].split(','))
        xtst.XTestFakeMotionEvent(d, -1, x, y, 0); x11.XFlush(d); time.sleep(0.3); continue
    if name == 'click':
        xtst.XTestFakeButtonEvent(d, 1, 1, 0); xtst.XTestFakeButtonEvent(d, 1, 0, 0); x11.XFlush(d); time.sleep(0.3); continue
    code = x11.XKeysymToKeycode(d, x11.XStringToKeysym(name.encode()))
    xtst.XTestFakeKeyEvent(d, code, 1, 0); xtst.XTestFakeKeyEvent(d, code, 0, 0); x11.XFlush(d)
    time.sleep(0.3)
