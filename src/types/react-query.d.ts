import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * The component shows this mutation's errors itself (inline status,
       * its own toast). Otherwise a failed mutation gets the global error toast.
       */
      handlesErrors?: boolean;
    };
  }
}
