export const rememberPassword = (password: string) => localStorage.setItem("password", password);
export const Login = () => <button onClick={() => rememberPassword("admin")}>Login</button>;
