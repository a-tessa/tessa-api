import { HTTPException } from "hono/http-exception";

export function badRequest(message = "Requisição inválida."): never {
  throw new HTTPException(400, { message });
}

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

export function payloadTooLarge(message = "Arquivo maior do que o permitido."): never {
  throw new HTTPException(413, { message });
}

export function internalServerError(message = "Erro interno do servidor."): never {
  throw new HTTPException(500, { message });
}
