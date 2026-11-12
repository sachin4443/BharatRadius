import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import apiClient from "../../services/api";

interface SubscriberPhotoProps {
  subscriber: any;
  size?: number;
  editable?: boolean;
  onUpdated?: (photoUrl: string) => void;
}

const SubscriberPhoto: React.FC<
  SubscriberPhotoProps
> = ({
  subscriber,
  size = 120,
  editable = false,
  onUpdated,
}) => {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [photoUrl, setPhotoUrl] =
    useState<string | null>(
      subscriber?.photoUrl ||
        subscriber?.PhotoUrl ||
        null
    );

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState("");

  // --------------------------------------------------
  // Update photo when subscriber changes
  // --------------------------------------------------

  useEffect(() => {
    setPhotoUrl(
      subscriber?.photoUrl ||
        subscriber?.PhotoUrl ||
        null
    );
  }, [
    subscriber?.photoUrl,
    subscriber?.PhotoUrl,
  ]);

  // --------------------------------------------------
  // Initial
  // --------------------------------------------------

  const getInitial = () => {
    const name =
      subscriber?.fullName ||
      subscriber?.FullName ||
      "S";

    return (
      name
        .trim()
        .charAt(0)
        .toUpperCase() || "S"
    );
  };

  // --------------------------------------------------
  // Open file selector
  // --------------------------------------------------

  const handleOpenFile = () => {
    if (!editable || uploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  // --------------------------------------------------
  // Upload photo
  // --------------------------------------------------

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    // Allow same file selection again
    e.target.value = "";

    if (!file) {
      return;
    }

    setError("");

    // ------------------------------------------------
    // Validate extension/type
    // ------------------------------------------------

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Only JPG, PNG and WEBP images are allowed."
      );
      return;
    }

    // ------------------------------------------------
    // Max 5 MB
    // ------------------------------------------------

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Image size must be less than 5 MB."
      );
      return;
    }

    // ------------------------------------------------
    // Local preview
    // ------------------------------------------------

    const localUrl =
      URL.createObjectURL(file);

    const oldPhoto =
      photoUrl;

    setPhotoUrl(localUrl);

    try {
      setUploading(true);

      const formData = new FormData();

      formData.append("file", file);

      const response =
        await apiClient.post(
          `/Subscribers/${subscriber.id}/photo`,
          formData,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );

      const savedPhotoUrl =
        response?.data?.photoUrl ||
        response?.data?.url;

      if (!savedPhotoUrl) {
        throw new Error(
          "Server did not return photo URL."
        );
      }

      // ------------------------------------------------
      // Permanent URL
      // ------------------------------------------------

      setPhotoUrl(savedPhotoUrl);

      onUpdated?.(savedPhotoUrl);
    } catch (err: any) {
      console.error(
        "Subscriber photo upload failed:",
        err
      );

      // Restore old photo
      setPhotoUrl(oldPhoto);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to upload subscriber photo."
      );
    } finally {
      setUploading(false);

      URL.revokeObjectURL(localUrl);
    }
  };

  return (
    <div
      className="position-relative"
      style={{
        width: size,
        height: size,
      }}
    >
      {/* ============================================
          PROFILE PHOTO
      ============================================ */}

      <div
        className="rounded-circle overflow-hidden bg-white border border-4 border-white shadow"
        style={{
          width: size,
          height: size,
          cursor: editable
            ? "pointer"
            : "default",
        }}
        onClick={handleOpenFile}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={
              subscriber?.fullName ||
              "Subscriber"
            }
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={() => {
              setPhotoUrl(null);
            }}
          />
        ) : (
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(135deg,#dbeafe,#eef2ff)",
              color: "#2563eb",
              fontWeight: 700,
              fontSize: size * 0.38,
            }}
          >
            {getInitial()}
          </div>
        )}
      </div>

      {/* ============================================
          CAMERA BUTTON
      ============================================ */}

      {editable && (
        <>
          <button
            type="button"
            className="btn btn-primary rounded-circle shadow d-flex align-items-center justify-content-center"
            style={{
              position: "absolute",
              right: -5,
              bottom: 3,
              width: 40,
              height: 40,
              border:
                "3px solid white",
              zIndex: 5,
            }}
            onClick={handleOpenFile}
            disabled={uploading}
            title="Change photo"
          >
            {uploading ? (
              <span
                className="spinner-border spinner-border-sm"
              />
            ) : (
              "📷"
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="d-none"
            onChange={handleFileChange}
          />
        </>
      )}

      {/* ============================================
          ERROR
      ============================================ */}

      {error && (
        <div
          className="position-absolute bg-white border border-danger rounded-3 shadow p-2"
          style={{
            top: size + 10,
            left: "50%",
            transform:
              "translateX(-50%)",
            width: 240,
            zIndex: 50,
          }}
        >
          <div className="text-danger small fw-semibold">
            {error}
          </div>

          <button
            type="button"
            className="btn btn-sm btn-link text-danger p-0"
            onClick={() =>
              setError("")
            }
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriberPhoto;