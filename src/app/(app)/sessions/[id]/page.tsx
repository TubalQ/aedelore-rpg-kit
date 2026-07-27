import { SessionEditor } from "@/components/session/session-editor";

type Params = { params: Promise<{ id: string }> };

export default async function SessionPage({ params }: Params) {
  const { id } = await params;
  return <SessionEditor sessionId={Number(id)} />;
}
