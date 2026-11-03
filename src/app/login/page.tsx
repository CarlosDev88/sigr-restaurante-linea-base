import { FormularioAccion } from "@/components/formulario-accion";
import { iniciarSesion } from "./actions";

export default function PaginaLogin() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="titulo">Iniciar sesión</h1>
      <FormularioAccion accion={iniciarSesion} textoBoton="Entrar" className="card flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Correo
          <input name="email" type="email" required className="input" autoComplete="username" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input name="password" type="password" required className="input" autoComplete="current-password" />
        </label>
      </FormularioAccion>
      <p className="mt-4 text-xs text-stone-500">
        Usuarios de prueba (seed): admin@sigr.local / Admin123* · mesero@sigr.local / Mesero123* ·
        cliente@sigr.local / Cliente123*
      </p>
    </div>
  );
}
