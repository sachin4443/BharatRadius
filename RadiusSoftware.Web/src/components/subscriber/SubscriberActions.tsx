import React from "react";
import SubscriberConnectionButton from "./SubscriberConnectionButton";

interface Props {
  subscriber: any;
  onEdit: (subscriber: any) => void;
  onDelete: (id: string) => void;
  onLive: (subscriber: any) => void;
  onChanged: () => void;
}

const SubscriberActions: React.FC<Props> = ({
  subscriber,
  onEdit,
  onDelete,
  onLive,
  onChanged,
}) => {
  return (
    <div className="d-flex justify-content-end align-items-center gap-2 flex-wrap">
      <SubscriberConnectionButton
        subscriber={subscriber}
        onChanged={onChanged}
        onLive={onLive}
      />

      <button
        type="button"
        className="btn btn-sm btn-outline-primary rounded-pill px-3"
        onClick={() => onLive(subscriber)}
      >
        📊 Live
      </button>

      <button
        type="button"
        className="btn btn-sm btn-light border rounded-pill px-3"
        onClick={() => onEdit(subscriber)}
      >
        ✏️ Edit
      </button>

      <button
        type="button"
        className="btn btn-sm btn-outline-danger rounded-pill px-3"
        onClick={() => onDelete(subscriber.id)}
      >
        🗑️
      </button>
    </div>
  );
};

export default SubscriberActions;