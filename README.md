# A10 / CPE102 Grand Prix

Viewbook วิชา CPE102 (มจธ.) ของทีม A10 เล่า 16 สัปดาห์ของภาคเรียนเป็นฤดูกาลแข่งรถ 16 สนาม
ทำด้วย Next.js 16, GSAP (ScrollTrigger, DrawSVG, MotionPath) และ Lenis

## รัน

```bash
npm install
npm run dev
```

เปิด http://localhost:3000

## แก้เนื้อหา

- หัวข้อ บันทึก และสนามที่ยังไม่ถึง (`NOT_YET`): `lib/data.ts`
- สีของนักขับแต่ละคน: `DRIVER_COLOR` ใน `lib/data.ts`

## ใส่รูป

วางไฟล์ใน `public/photos/` ตามชื่อใน `public/photos/README.txt` (เช่น `cover.jpg`, `week-01.jpg`, `driver-25.jpg`)
หรือคลิก/ลากรูปไปวางที่ช่องบนหน้าเว็บ (เก็บไว้ในเบราว์เซอร์เครื่องนั้นเท่านั้น)

แผนที่ในแถบสนามแข่งมาจากผังแม่บท มจธ.บางมด (สำนักบริหารอาคารและสถานที่)
