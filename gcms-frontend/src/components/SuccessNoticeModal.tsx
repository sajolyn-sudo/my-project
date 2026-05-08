import Modal from "./Modal";

export default function SuccessNoticeModal({
  open,
  onClose,
  title = "Success",
  message,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "white",
              color: "#0f172a",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
}
