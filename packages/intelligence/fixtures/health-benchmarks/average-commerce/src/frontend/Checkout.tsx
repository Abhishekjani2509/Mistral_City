export const Checkout = ({ email }: { email: string }) => {
  const emailIsValid = email.includes("@");
  return <button disabled={!emailIsValid}>Pay</button>;
};
