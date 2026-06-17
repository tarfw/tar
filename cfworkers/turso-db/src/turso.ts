export interface Env {
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
  TURSO_PLATFORM_API_TOKEN: string;
  TURSO_ORG: string;
  TURSO_GROUP: string;
  R2_BUCKET?: R2Bucket;
  AI?: any;
}

export async function queryTurso(tursoUrl: string, tursoToken: string, sql: string, params: any[] = []): Promise<any> {
  const httpTursoUrl = tursoUrl.replace("libsql://", "https://");
  const requests = [
    {
      type: "execute",
      stmt: {
        sql,
        args: params.map((p: any) => {
          if (p === null) return { type: "null" };
          if (typeof p === "number") return { type: "float", value: p };
          return { type: "text", value: String(p) };
        })
      }
    },
    { type: "close" }
  ];
  const res = await fetch(`${httpTursoUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tursoToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso DB Query Failed: ${text}`);
  }
  const data = await res.json() as any;
  const execResult = data.results?.[0];
  if (execResult?.type === "error") {
    throw new Error(`Turso DB Statement Error: ${execResult.error.message}`);
  }
  return execResult?.response?.result;
}

export function rowsToObjects(result: any): any[] {
  if (!result?.rows) return [];
  const cols = result.cols.map((c: any) => c.name || c);
  return result.rows.map((row: any[]) => {
    const obj: any = {};
    row.forEach((cell: any, i: number) => {
      obj[cols[i]] = cell?.value !== undefined ? cell.value : cell;
    });
    return obj;
  });
}
