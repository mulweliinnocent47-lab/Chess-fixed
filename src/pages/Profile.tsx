import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Save, User } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { loadProfile, saveProfile, type Profile } from "@/lib/chess/profile";
import { Input } from "@/components/ui/input";
import defaultAvatar from "@/assets/home/player-avatar.jpg";

function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const onPickFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      alert("Please choose an image under 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfile((p) => ({ ...p, avatar: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const onSave = () => {
    saveProfile({
      ...profile,
      name: profile.name.trim() || "Player",
      rating: Math.max(100, Math.min(3000, Math.floor(profile.rating))),
    });
    setSaved(true);
    setTimeout(() => navigate("/"), 600);
  };

  const avatarSrc = profile.avatar || defaultAvatar;

  return (
    <PageTransition>
      <main className="min-h-screen w-full px-4 py-5 pb-10">
        <div className="mx-auto w-full max-w-md flex flex-col gap-4">
          <header className="flex items-center gap-2">
            <Link
              to="/"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-extrabold tracking-tight">Edit Profile</h1>
          </header>

          <section
            className="rounded-2xl p-5 border border-border flex flex-col items-center gap-4"
            style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}
          >
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full overflow-hidden ring-2"
                style={{ boxShadow: "var(--shadow-glow-blue)" }}
              >
                <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <label
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full inline-flex items-center justify-center cursor-pointer text-primary-foreground"
                style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="w-full space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Display name
                </label>
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your name"
                  maxLength={24}
                  className="mt-1 h-11 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Rating
                </label>
                <Input
                  type="number"
                  value={profile.rating}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, rating: Number(e.target.value) || 0 }))
                  }
                  min={100}
                  max={3000}
                  className="mt-1 h-11 rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Your rating updates automatically as you win games.
                </p>
              </div>
            </div>

            <button
              onClick={onSave}
              className="w-full h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 text-primary-foreground"
              style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-glow)" }}
            >
              {saved ? (
                <>
                  <User className="w-4 h-4" /> Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Profile
                </>
              )}
            </button>
          </section>

          <p className="text-[11px] text-muted-foreground text-center">
            Your profile is stored locally on this device.
          </p>
        </div>
      </main>
    </PageTransition>
  );
}

export default ProfilePage;
