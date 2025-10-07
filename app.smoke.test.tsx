import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

describe("StudioCast App", () => {
  it("renders login screen", () => {
    render(<App />);
    expect(screen.getByText(/StudioCast Portal/i)).toBeInTheDocument();
  });

  it("logs in (smoke)", async () => {
    render(<App />);
    const email = screen.getByPlaceholderText(/you@studio.com/i);
    await userEvent.type(email, "tester@example.com");
    await userEvent.click(screen.getByRole("button", { name: /enter portal/i }));
    expect(email).toBeInTheDocument();
  });
});
