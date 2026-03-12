import { HTTPException } from "hono/http-exception";

export function unauthorized(message = "Não autenticado.") {
  throw new HTTPException(401, { message });
}

export function forbidden(message = "Você não tem permissão para esta ação.") {
  throw new HTTPException(403, { message });
}

export function notFound(message = "Recurso não encontrado.") {
  throw new HTTPException(404, { message });
}

export function conflict(message: string) {
  throw new HTTPException(409, { message });
}
