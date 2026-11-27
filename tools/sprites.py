from PIL import Image
import sys
W=H=32
PAL={'o':(26,16,20),'s':(217,154,91),'d':(168,104,58),'h':(242,198,138),'k':(42,27,18),
     't':(142,31,43),'u':(92,26,26),'e':(26,16,20),'g':(232,185,58)}
ST={1:dict(s=4,w=3,t=1,b=0,f=1,n=0,th=2,c=1,L=3,g=1),
    2:dict(s=5,w=3,t=2,b=0,f=2,n=0,th=2,c=2,L=3,g=1),
    3:dict(s=6,w=3,t=2,b=1,f=2,n=1,th=3,c=2,L=4,g=1),
    4:dict(s=7,w=4,t=3,b=1,f=2,n=1,th=4,c=2,L=4,g=0),
    5:dict(s=8,w=4,t=3,b=2,f=3,n=1,th=4,c=3,L=4,g=0),
    6:dict(s=9,w=4,t=4,b=3,f=3,n=2,th=5,c=3,L=4,g=0)}
def draw(p):
    g=[[None]*W for _ in range(H)]
    def px(d,r,c):
        if 0<=r<H and 0<=d<=15:
            g[r][15-d]=c; g[r][16+d]=c
    def box(d0,d1,r0,r1,c):
        for r in range(r0,r1+1):
            for d in range(d0,d1+1): px(d,r,c)
    s,w,t,b,f,n,th,c,L,gap=[p[k] for k in ('s','w','t','b','f','n','th','c','L','g')]
    # head
    box(0,2,2,3,'k'); box(0,2,4,7,'s'); px(1,5,'e'); px(0,7,'d')
    box(0,n,8,8,'d' if n==0 else 's')
    # torso
    top=9
    for r in range(top,20):
        hw=round(s+(w-s)*(r-top)/10)
        for d in range(0,hw+1): px(d,r,'s')
        if r>=13: px(hw,r,'d')
    # traps
    if n>=1: box(n+1,min(n+2,s-1),8,8,'s')
    # pecs
    pr=top+3 if s>=6 else top+2
    for d in range(1,max(2,s-2)+1): px(d,pr,'d')
    if s>=6:
        px(0,top+1,'d'); px(0,top+2,'d')
        for d in range(1,s-2): px(d,top,'h')
    # abs
    if s>=6:
        for r in (pr+2,pr+4):
            px(0,r,'d'); 
            if r<19: px(2,r,'d')
    # upper arm
    e=s+L-1
    box(s,e,top,top+t-1,'s')
    for d in range(s,e+1): px(d,top+t-1,'d')
    # biceps
    for i in range(b):
        d0=s+1+ (i//2); d1=e-1-(i+1)//2
        if d1>=d0: box(d0,d1,top-1-i,top-1-i,'s')
    if b>0:
        d0=s+1+((b-1)//2); px(d0,top-b,'h'); 
        if e-1-(b)//2>d0: px(d0+1,top-b,'h')
    # delts
    if s>=6: px(s-1,top-1,'s'); px(s,top-1,'s'); px(s-1,top-1,'h')
    # forearm + fist
    box(e,e+f-1,4,top+t-1,'s')
    for r in range(4,top+t): px(e+f-1,r,'d')
    box(e-1,e+f-1,3,4,'s'); px(e-1,3,'h')
    # trunks
    box(0,w,20,21,'t'); 
    for d in range(0,w+1): px(d,21,'u')
    # thighs
    for r in range(22,27):
        extra=1 if (th>=4 and r in (22,23,24)) else 0
        box(gap,gap+th-1+extra,r,r,'s'); px(gap+th-1+extra,r,'d')
        if gap==0 and r>=23: px(0,r,'d')
    g2=max(gap,1)
    for r in range(27,30):
        box(g2,g2+c-1,r,r,'s'); 
        if c>1: px(g2+c-1,r,'d')
    box(g2,g2+c,30,30,'k')
    # outline
    out=[row[:] for row in g]
    for r in range(H):
        for x in range(W):
            if g[r][x] is None:
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    xx,yy=x+dx,r+dy
                    if 0<=xx<W and 0<=yy<H and g[yy][xx] is not None:
                        out[r][x]='o'; break
    return out
def img(grid,scale=8,bg=None,remap=None):
    h=len(grid); w=len(grid[0])
    im=Image.new('RGBA',(w,h),bg or (0,0,0,0))
    for r in range(h):
        for x in range(w):
            c=grid[r][x]
            if c:
                col=(remap or PAL)[c]; im.putpixel((x,r),col+(255,))
    return im.resize((w*scale,h*scale),Image.NEAREST)
if __name__=='__main__':
    out=sys.argv[1]
    sheet=Image.new('RGBA',(6*32*8+7*16,32*8+32),(14,14,18,255))
    for i in range(1,7):
        im=img(draw(ST[i])); im.save(f'{out}/hero{i}.png')
        sheet.alpha_composite(im,(16+(i-1)*(256+16),16))
    # icon: crop upper body of stage 6, gold palette
    g=draw(ST[6]); crop=[row[1:31] for row in g[1:23]]
    GOLD={'o':(20,12,6),'s':(232,185,58),'d':(168,123,30),'h':(255,224,138),'k':(92,26,26),'t':(142,31,43),'u':(92,26,26),'e':(20,12,6)}
    ic=Image.new('RGBA',(32,32),(17,17,24,255))
    for x in range(32):
        for y in range(32):
            if x in (0,31) or y in (0,31): ic.putpixel((x,y),(92,26,26,255))
            elif x in (1,30) or y in (1,30): ic.putpixel((x,y),(142,31,43,255))
    for r,row in enumerate(crop):
        for x,c in enumerate(row):
            if c: ic.putpixel((x+1,r+6),GOLD[c]+(255,))
    ic=ic.resize((512,512),Image.NEAREST); ic.save(f'{out}/icon.png')
    sheet.save(f'{out}/sheet.png')
