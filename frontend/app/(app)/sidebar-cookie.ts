// Plain module (not "use client"): the server layout reads it and the client shell writes it.
// A constant exported from a "use client" file reaches server code as a client reference, not a string.
export const SIDEBAR_COOKIE = "sidebar_state";
