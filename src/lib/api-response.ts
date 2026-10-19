export function success<T extends object>(message: string, data: T, code = 200) {
  return Response.json({ status: "success", code, message, ...data }, { status: code });
}

export function failure(message: string, code: number) {
  return Response.json({ status: "error", code, message }, { status: code });
}
