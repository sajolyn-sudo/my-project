import React, { useCallback, useMemo, useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { User, Shield, Camera, Check, X } from "lucide-react";
import Cropper, { type Area } from "react-easy-crop";

type AnyRecord = Record<string, any>;

function initialsOf(fname?: string, lname?: string) {
  const a = (fname?.trim()?.[0] ?? "U").toUpperCase();
  const b = (lname?.trim()?.[0] ?? "").toUpperCase();
  return a + b;
}

/** Convert imageSrc (dataURL) to HTMLImageElement */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });
}

/** Crop by pixel area, return base64 dataURL */
async function getCroppedDataUrl(
  imageSrc: string,
  pixelCrop: Area,
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  canvas.width = Math.max(1, Math.floor(pixelCrop.width));
  canvas.height = Math.max(1, Math.floor(pixelCrop.height));

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}

function ToggleButton({
  icon,
  title,
  description,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 18,
        border: active
          ? "2px solid rgba(251,191,36,0.8)"
          : "1px solid rgba(15,23,42,0.08)",
        background: active ? "rgba(251,191,36,0.14)" : "rgba(255,255,255,0.85)",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: "0 10px 18px rgba(0,0,0,0.05)",
        transition: "all .25s ease",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            border: "1px solid rgba(15,23,42,0.10)",
            background: "rgba(255,255,255,0.8)",
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}

function AnimatedSection({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        maxHeight: open ? 520 : 0,
        opacity: open ? 1 : 0,
        overflow: "hidden",
        transition:
          "max-height .35s cubic-bezier(.4,0,.2,1), opacity .25s ease",
      }}
    >
      <div
        style={{
          transform: open ? "translateY(0)" : "translateY(-6px)",
          transition: "transform .25s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ActionButton({
  text,
  onClick,
  variant = "yellow",
}: {
  text: string;
  onClick?: () => void;
  variant?: "yellow" | "blue";
}) {
  const isYellow = variant === "yellow";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 40,
        padding: "0 14px",
        borderRadius: 14,
        border: isYellow
          ? "1px solid rgba(251,191,36,0.35)"
          : "1px solid rgba(37,99,235,0.28)",
        background: isYellow
          ? "linear-gradient(135deg, rgba(251,191,36,1), rgba(245,158,11,1))"
          : "linear-gradient(180deg, rgba(37,99,235,0.12), rgba(37,99,235,0.06))",
        fontWeight: 1000,
        cursor: "pointer",
        boxShadow: isYellow
          ? "0 14px 22px rgba(245,158,11,0.18)"
          : "0 12px 20px rgba(37,99,235,0.10)",
        color: isYellow ? "rgba(9,14,25,1)" : "rgba(37,99,235,1)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      {text}
    </button>
  );
}

function CollapsibleCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.86)",
        borderRadius: 18,
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 15px 30px rgba(15,23,42,0.06)",
        overflow: "hidden",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(15,23,42,0.03)",
          cursor: "pointer",
          fontWeight: 1000,
          userSelect: "none",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{open ? "−" : "+"}</span>
      </div>

      <div
        style={{
          maxHeight: open ? 600 : 0,
          overflow: "hidden",
          transition: "max-height .3s ease",
        }}
      >
        <div style={{ padding: open ? 14 : 0 }}>{open ? children : null}</div>
      </div>
    </div>
  );
}

function CompactField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          marginBottom: 4,
          fontWeight: 900,
          color: "#64748b",
        }}
      >
        {label}
      </div>
      <div
        style={{
          height: 36,
          borderRadius: 10,
          border: "1px solid rgba(15,23,42,0.08)",
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.75)",
          fontWeight: 900,
          fontSize: 13,
          color: "#0f172a",
        }}
        title={value}
      >
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function CompactInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          marginBottom: 4,
          fontWeight: 900,
          color: "#64748b",
        }}
      >
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 36,
          borderRadius: 10,
          border: "1px solid rgba(15,23,42,0.12)",
          padding: "0 10px",
          background: "rgba(255,255,255,0.85)",
          fontWeight: 800,
          fontSize: 13,
          outline: "none",
        }}
        placeholder={label}
      />
    </div>
  );
}

export default function Account() {
  const user = useAuthStore((s: AnyRecord) => s.user);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

  // read-only profile view fields (student cannot save)
  const [profile] = useState({
    fname: user?.fname ?? "",
    lname: user?.lname ?? "",
    email: user?.email ?? "",
  });

  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  // avatar + border style
  const [photo, setPhoto] = useState<string | null>(null);
  const [borderStyle] = useState<"none" | "blue" | "yellow" | "gradient">(
    "gradient",
  );

  const border = useMemo(() => {
    if (borderStyle === "none") return "none";
    if (borderStyle === "blue") return "3px solid rgba(37,99,235,0.65)";
    if (borderStyle === "yellow") return "3px solid rgba(251,191,36,0.85)";
    return "3px solid transparent";
  }, [borderStyle]);

  // crop modal
  const [cropOpen, setCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [savingCrop, setSavingCrop] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handlePhotoPick = () => fileRef.current?.click();

  const handlePhotoChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(String(reader.result || ""));
      setCropOpen(true);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const closeCrop = () => {
    if (savingCrop) return;
    setCropOpen(false);
    setImageSrc(null);
  };

  const saveCropped = async () => {
    if (!imageSrc) return;
    try {
      setSavingCrop(true);
      if (!croppedAreaPixels) {
        setPhoto(imageSrc);
      } else {
        const cropped = await getCroppedDataUrl(imageSrc, croppedAreaPixels);
        setPhoto(cropped);
      }
      closeCrop();
    } catch {
      setPhoto(imageSrc);
      closeCrop();
    } finally {
      setSavingCrop(false);
    }
  };

  if (!user) return null;

  // map possible field names from your user object
  const college =
    user.college ??
    user.college_name ??
    user.collegeName ??
    user.colleges_name ??
    "—";
  const course =
    user.course ??
    user.course_name ??
    user.program ??
    user.program_name ??
    user.courseName ??
    "—";
  const yearLevel =
    user.yearLevel ??
    user.year_level ??
    user.year_level_name ??
    user.yearLevelName ??
    user.yearlevel ??
    "—";

  const pageBg =
    "radial-gradient(1000px 400px at 20% -10%, rgba(37,99,235,0.15), transparent 60%), radial-gradient(900px 420px at 100% 0%, rgba(250,204,21,0.12), transparent 55%), #f6f7fb";

  return (
    <div style={{ minHeight: "100vh", padding: 18, background: pageBg }}>
      <div
        style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}
      >
        {/* ACCOUNT HEADER BOX */}
        <div
          style={{
            background: "rgba(255,255,255,0.88)",
            borderRadius: 24,
            padding: 28,
            border: "1px solid rgba(15,23,42,0.08)",
            boxShadow: "0 25px 60px rgba(15,23,42,0.08)",
            backdropFilter: "blur(12px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 28,
          }}
        >
          {/* LEFT SIDE - TEXT */}
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 1000 }}>Account</div>
              <div
                style={{
                  fontSize: 14,
                  color: "#64748b",
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                Update your student profile, photo, and password.
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                👤 {profile.fname} {profile.lname}
              </div>

              <div style={{ color: "#64748b", fontWeight: 800 }}>
                📧 {profile.email}
              </div>

              <div
                style={{
                  fontWeight: 900,
                  color: "rgba(37,99,235,1)",
                  fontSize: 13,
                }}
              >
                🎓 {user.role}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - BIGGER PHOTO */}
          <div style={{ position: "relative" }}>
            {/* gradient border wrapper */}
            <div
              style={{
                width: 170,
                height: 170,
                borderRadius: 40,
                padding: borderStyle === "gradient" ? 4 : 0,
                background:
                  borderStyle === "gradient"
                    ? "linear-gradient(135deg, rgba(37,99,235,1), rgba(251,191,36,1))"
                    : "transparent",
                boxShadow: "0 25px 50px rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 36,
                  overflow: "hidden",
                  background: "#e2e8f0",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 1000,
                  fontSize: 36,
                  border: borderStyle === "gradient" ? "none" : border,
                }}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt="profile"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  initialsOf(profile.fname, profile.lname)
                )}
              </div>
            </div>

            {/* Camera Button */}
            <button
              type="button"
              onClick={handlePhotoPick}
              style={{
                position: "absolute",
                bottom: -12,
                right: -12,
                width: 52,
                height: 52,
                borderRadius: 18,
                border: "1px solid rgba(251,191,36,0.35)",
                background:
                  "linear-gradient(135deg, rgba(251,191,36,1), rgba(245,158,11,1))",
                color: "rgba(9,14,25,1)",
                cursor: "pointer",
                boxShadow: "0 18px 28px rgba(0,0,0,0.25)",
                display: "grid",
                placeItems: "center",
              }}
              title="Upload photo"
            >
              <Camera size={22} />
            </button>

            {/* Status Badge */}
            <div
              style={{
                position: "absolute",
                top: -10,
                left: -10,
                padding: "6px 14px",
                borderRadius: 999,
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "white",
                fontWeight: 900,
                fontSize: 12,
                boxShadow: "0 0 14px rgba(34,197,94,0.7)",
              }}
            >
              Active
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: "none" }}
            />
          </div>
        </div>

        {/* TOGGLES */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <ToggleButton
            icon={<User size={18} />}
            title="Profile Details"
            description="View personal & academic info"
            active={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
          />
          <ToggleButton
            icon={<Shield size={18} />}
            title="Security"
            description="Change your password"
            active={activeTab === "security"}
            onClick={() => setActiveTab("security")}
          />
        </div>

        {/* PROFILE (compact + collapsible inside) */}
        <AnimatedSection open={activeTab === "profile"}>
          <CollapsibleCard title="Personal & Academic Information" defaultOpen>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <CompactField label="First Name" value={profile.fname || "—"} />
              <CompactField label="Last Name" value={profile.lname || "—"} />
              <CompactField label="Email" value={profile.email || "—"} />
              <CompactField label="College" value={String(college)} />
              <CompactField label="Course" value={String(course)} />
              <CompactField label="Year Level" value={String(yearLevel)} />
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#64748b",
                fontWeight: 800,
              }}
            >
              Profile details are managed by the administrator.
            </div>
          </CollapsibleCard>
        </AnimatedSection>

        {/* SECURITY (compact + collapsible inside) */}
        <AnimatedSection open={activeTab === "security"}>
          <CollapsibleCard title="Security Settings" defaultOpen>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <CompactInput
                label="Current Password"
                type="password"
                value={password.current}
                onChange={(v) => setPassword((p) => ({ ...p, current: v }))}
              />
              <CompactInput
                label="New Password"
                type="password"
                value={password.next}
                onChange={(v) => setPassword((p) => ({ ...p, next: v }))}
              />
              <CompactInput
                label="Confirm Password"
                type="password"
                value={password.confirm}
                onChange={(v) => setPassword((p) => ({ ...p, confirm: v }))}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <ActionButton
                text="Update Password"
                variant="blue"
                onClick={() => {}}
              />
            </div>
          </CollapsibleCard>
        </AnimatedSection>
      </div>

      {/* CROP MODAL */}
      {cropOpen && imageSrc ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.62)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCrop();
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              borderRadius: 20,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(255,255,255,0.16)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
              overflow: "hidden",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                borderBottom: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ fontWeight: 1000 }}>Crop Photo</div>
              <button
                type="button"
                onClick={closeCrop}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "rgba(255,255,255,0.9)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* cropper area */}
            <div
              style={{
                position: "relative",
                height: 420,
                background: "#111827",
              }}
            >
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* controls */}
            <div
              style={{
                padding: 14,
                display: "grid",
                gap: 12,
                borderTop: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}
                >
                  Zoom
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
              >
                <button
                  type="button"
                  onClick={closeCrop}
                  disabled={savingCrop}
                  style={{
                    height: 42,
                    padding: "0 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "rgba(255,255,255,0.9)",
                    cursor: savingCrop ? "not-allowed" : "pointer",
                    fontWeight: 950,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveCropped}
                  disabled={savingCrop}
                  style={{
                    height: 42,
                    padding: "0 16px",
                    borderRadius: 14,
                    border: "1px solid rgba(251,191,36,0.35)",
                    background:
                      "linear-gradient(135deg, rgba(251,191,36,1), rgba(245,158,11,1))",
                    cursor: savingCrop ? "not-allowed" : "pointer",
                    fontWeight: 1000,
                    color: "rgba(9,14,25,1)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Check size={18} />
                  {savingCrop ? "Saving..." : "Done"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
