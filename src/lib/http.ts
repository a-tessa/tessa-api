import { HTTPException } from "hono/http-exception";

export function unauthorized(message = "Não autenticado."): never {
  throw new HTTPException(401, { message });
}

export function forbidden(message = "Você não tem permissão para esta ação."): never {
  throw new HTTPException(403, { message });
}

export function notFound(message = "Recurso não encontrado."): never {
  throw new HTTPException(404, { message });
}

export function conflict(message: string): never {
  throw new HTTPException(409, { message });
}
