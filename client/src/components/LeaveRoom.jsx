import ConfirmAction from "./ConfirmAction.jsx";

export default function LeaveRoom({ onLeave, disabled }) {
  return (
    <ConfirmAction
      label="Leave room"
      question="Leave this room? Your seat and any vote will be removed."
      confirmText="Leave"
      cancelText="Stay"
      onConfirm={onLeave}
      disabled={disabled}
    />
  );
}
