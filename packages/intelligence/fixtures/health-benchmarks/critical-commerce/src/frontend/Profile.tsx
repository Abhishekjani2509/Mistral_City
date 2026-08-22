export const Profile = ({ biography }: { biography: string }) => <section dangerouslySetInnerHTML={{ __html: biography }} />;
export const rememberSession = (sessionId: string) => localStorage.setItem("sessionToken", sessionId);
