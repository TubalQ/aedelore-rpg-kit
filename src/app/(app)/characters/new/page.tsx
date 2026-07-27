import { CreateCharacterForm } from "@/components/character/create-character-form";

export default function NewCharacterPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-text-base">Ny karaktär</h1>
      <CreateCharacterForm />
    </div>
  );
}
