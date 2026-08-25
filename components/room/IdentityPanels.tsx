import "./room.css";

/** Two terminal-style wall plaques above the monitor. */
export default function IdentityPanels() {
  return (
    <div className="identity-panels">
      <div className="identity-panel identity-panel--name">
        <p className="identity-panel__name">CHRISTOPHER LUNA</p>
        <p className="identity-panel__role">SOFTWARE ENGINEER</p>
      </div>
      <div className="identity-panel identity-panel--edu">
        <pre className="identity-panel__cap" aria-hidden="true">{`  ____
 /____\\
 \\____/
   ||`}</pre>
        <p className="identity-panel__edu">
          B.S. COMPUTER SCIENCE
          <br />
          CALIFORNIA STATE UNIVERSITY,
          <br />
          DOMINGUEZ HILLS
        </p>
      </div>
    </div>
  );
}
