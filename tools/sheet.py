import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
def key_green(im):
    a = np.array(im.convert('RGBA')).astype(np.int16)
    r,g,b = a[...,0],a[...,1],a[...,2]
    green = (g > r + 50) & (g > b + 50) & (g > 120)
    a[green,3] = 0
    spill = (g > r+10) & (g > b+10) & (a[...,3]>0)
    a[...,1] = np.where(spill, np.maximum(r,b)+ (g-np.maximum(r,b))//3, g)
    return Image.fromarray(a.clip(0,255).astype(np.uint8),'RGBA')
def comps(im, min_area=600, dilate=5):
    al = np.array(im)[...,3] > 60
    lab, n = ndimage.label(ndimage.binary_dilation(al, iterations=dilate))
    out=[]
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None: continue
        ys,xs=sl; area=int((al[sl]&(lab[sl]==i+1)).sum())
        if area<min_area: continue
        out.append((xs.start,ys.start,xs.stop,ys.stop))
    out.sort(key=lambda b:(round(((b[1]+b[3])/2)/120), b[0]))
    return out
if __name__=='__main__':
    im=key_green(Image.open(sys.argv[1])); bx=comps(im)
    d=Image.new('RGBA',im.size,(255,255,255,255)); d.alpha_composite(im); dr=ImageDraw.Draw(d)
    for i,b in enumerate(bx): dr.rectangle(b,outline=(255,0,0)); dr.text((b[0]+2,b[1]+2),str(i),fill=(255,0,0))
    d.convert('RGB').save(sys.argv[2]); print(len(bx), bx)
