from PIL import Image
ims=[Image.open('shots/arms_%s.jpg'%k) for k in ['eye','side','top','front']]
W,H=ims[0].size; o=Image.new('RGB',(W*2,H*2))
for i,im in enumerate(ims): o.paste(im,((i%2)*W,(i//2)*H))
o.save('shots/arms_sheet.jpg')
