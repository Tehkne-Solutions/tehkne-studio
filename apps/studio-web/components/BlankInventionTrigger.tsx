"use client";

export function BlankInventionTrigger() {
  return (
    <button
      type="button"
      aria-label="Criar projeto de invenção vazio"
      data-testid="blank-invention-trigger"
      onClick={() => window.dispatchEvent(new CustomEvent("tehkne:open-invention"))}
      style={{
        position: "fixed",
        right: 18,
        bottom: 48,
        zIndex: 36,
        border: "1px solid #756b52",
        background: "#25231d",
        color: "#e5ddca",
        padding: "10px 14px",
        fontSize: 10,
        letterSpacing: ".1em",
        cursor: "pointer"
      }}
    >
      PROJETO VAZIO · S2.10
    </button>
  );
}
