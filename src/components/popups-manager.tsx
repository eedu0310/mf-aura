"use client";

import { useState, useEffect } from "react";
import { MotivationalPopup } from "@/components/motivational-popup";
import { DailyTasksPopup } from "@/components/daily-tasks-popup";
import {
  foiMotivacionalMostrado,
  foiTarefasMostrado,
  marcarMotivacionalMostrado,
  marcarTarefasMostrado,
} from "@/lib/cache-popups-diarios";
import { useUserProfile } from "@/lib/user-profile-context";

export function PopupsManager() {
  const { profile } = useUserProfile();
  const [mostrarMotivacional, setMostrarMotivacional] = useState(false);
  const [mostrarTarefas, setMostrarTarefas] = useState(false);

  useEffect(() => {
    if (!foiMotivacionalMostrado()) {
      setMostrarMotivacional(true);
    } else if (!foiTarefasMostrado()) {
      setMostrarTarefas(true);
    }
  }, []);

  const handleMotivacionalClose = () => {
    setMostrarMotivacional(false);
    marcarMotivacionalMostrado();
    setTimeout(() => setMostrarTarefas(true), 300);
  };

  const handleTarefasClose = () => {
    setMostrarTarefas(false);
    marcarTarefasMostrado();
  };

  return (
    <>
      <MotivationalPopup
        nome={profile.nome}
        onClose={handleMotivacionalClose}
        aberto={mostrarMotivacional}
      />
      <DailyTasksPopup
        onClose={handleTarefasClose}
        aberto={mostrarTarefas}
      />
    </>
  );
}