import type { SVGProps } from "react";
import { useLottie } from "lottie-react";
import { UserIcon } from "@/lib/icons";
import type { Gender } from "@/lib/types";
import { cn } from "@/lib/cn";
import maleProfileAnimation from "@/assets/lottie/male-profile.json";
import femaleProfileAnimation from "@/assets/lottie/female-profile.json";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Lottie artboards include empty padding; zoom so the face fills the clip. */
const LOTTIE_ZOOM = 1.45;

function ProfileLottie({
  animationData,
  size,
  className,
}: {
  animationData: object;
  size: number;
  className?: string;
}) {
  const renderSize = Math.round(size * LOTTIE_ZOOM);
  const { View } = useLottie(
    {
      animationData,
      loop: true,
      autoplay: true,
      rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
    },
    { width: renderSize, height: renderSize },
  );

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {View}
    </span>
  );
}

export function ProfileGenderIcon({
  gender,
  size = 24,
  className,
  ...props
}: IconProps & { gender?: Gender | null }) {
  if (gender === "male") {
    return (
      <ProfileLottie animationData={maleProfileAnimation} size={size} className={className} />
    );
  }
  if (gender === "female") {
    return (
      <ProfileLottie animationData={femaleProfileAnimation} size={size} className={className} />
    );
  }
  return <UserIcon size={size} className={className} {...props} />;
}
