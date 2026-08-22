import { useState } from "react";

export const Checkout = () => {
  const [submitting, setSubmitting] = useState(false);
  return <button disabled={submitting} onClick={() => setSubmitting(true)}>Place order</button>;
};
