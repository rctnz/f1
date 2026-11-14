import fs from "node:fs";
import path from "node:path";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Calendar from "@/components/Calendar";
import Handover from "@/components/Handover";
import TimingSheet from "@/components/TimingSheet";
import Rounds from "@/components/Rounds";
import DriverTags from "@/components/DriverTags";
import Footer from "@/components/Footer";
import ProgressBar from "@/components/ProgressBar";
import SmoothScroll from "@/components/SmoothScroll";
import { DRIVERS, ROUNDS } from "@/lib/data";

const EXT = ["jpg", "jpeg", "png", "webp"];

/** a photo dropped into public/photos/<id>.<ext> wins over the in-browser slot */
function findPhoto(id: string): string | null {
  for (const ext of EXT) {
    if (fs.existsSync(path.join(process.cwd(), "public", "photos", `${id}.${ext}`))) return `/photos/${id}.${ext}`;
  }
  return null;
}

export default function Page() {
  const ids = ["cover", ...ROUNDS.map((r) => `week-${r.nn}`), ...DRIVERS.map((d) => `driver-${d.no}`)];
  const photos = Object.fromEntries(ids.map((id) => [id, findPhoto(id)]));

  return (
    <>
      <a className="skip" href="#main">
        ข้ามไปที่เนื้อหา
      </a>
      <ProgressBar />
      <Hero cover={photos.cover}>
        <Header />
      </Hero>
      <main id="main">
        <Calendar />
        <Handover from="poster" to="tele" />
        <TimingSheet />
        <Handover from="tele" to="poster" />
        <Rounds photos={photos} />
        <DriverTags photos={photos} />
      </main>
      <Handover from="poster" to="tele" />
      <Footer />
      <SmoothScroll />
    </>
  );
}
