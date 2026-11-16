import { CodedHttpError } from "@/lib/api/http-error";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, type PasswordProblem } from "@/lib/auth/password-policy";

/** The 400 a refused password gets, with the length limit where it applies. */
export function passwordProblemError(problem: PasswordProblem): CodedHttpError {
  if (problem === "passwordTooShort") return new CodedHttpError(400, problem, { min: MIN_PASSWORD_LENGTH });
  if (problem === "passwordTooLong") return new CodedHttpError(400, problem, { max: MAX_PASSWORD_LENGTH });
  return new CodedHttpError(400, problem);
}
