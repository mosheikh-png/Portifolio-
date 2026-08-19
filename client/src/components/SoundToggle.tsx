import { Volume2, VolumeX } from "lucide-react";
import { useSound } from "@/contexts/SoundContext";
import { soundEngine } from "@/lib/sound-engine";

export default function SoundToggle({ className = "" }: { className?: string }) {
  const { enabled, toggle } = useSound();

  const handleClick = () => {
    if (enabled) {
      soundEngine.play("click");
    }
    toggle();
    if (!enabled) {
      requestAnimationFrame(() => {
        soundEngine.play("click");
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`sound-toggle ${className}`}
      aria-label={enabled ? "Mute sounds" : "Enable sounds"}
      title={enabled ? "Mute sounds" : "Enable sounds"}
    >
      {enabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
    </button>
  );
}
