"use server";

// What happens when an organiser saves, changes or deletes a book.
// These run on the server. Supabase's Row Level Security also checks every
// request, so an organiser can only ever touch their own books.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  earliestDate,
  isBookId,
  isValidDate,
  limits,
  todayInUK,
} from "@/lib/books";
import { createClient } from "@/lib/supabase/server";

export type BookFields = {
  full_name: string;
  known_as: string;
  date_of_birth: string;
  date_of_death: string;
  lived_in: string;
  introduction: string;
};

export type BookFormState = {
  /** A problem with the whole form, in plain words. */
  error?: string;
  /** A problem with one answer, shown next to it. */
  fieldErrors?: Partial<Record<keyof BookFields, string>>;
  /** What the organiser typed, so nothing is lost if there's a problem. */
  values?: BookFields;
};

function readFields(formData: FormData): BookFields {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    full_name: get("full_name"),
    known_as: get("known_as"),
    date_of_birth: get("date_of_birth"),
    date_of_death: get("date_of_death"),
    lived_in: get("lived_in"),
    introduction: get("introduction"),
  };
}

function check(values: BookFields): BookFormState["fieldErrors"] {
  const errors: BookFormState["fieldErrors"] = {};
  const today = todayInUK();

  if (!values.full_name) {
    errors.full_name = "Please enter their full name.";
  } else if (values.full_name.length > limits.full_name) {
    errors.full_name = `Please keep this to ${limits.full_name} characters or fewer.`;
  }
  if (values.known_as.length > limits.known_as) {
    errors.known_as = `Please keep this to ${limits.known_as} characters or fewer.`;
  }
  if (values.lived_in.length > limits.lived_in) {
    errors.lived_in = `Please keep this to ${limits.lived_in} characters or fewer.`;
  }
  if (values.introduction.length > limits.introduction) {
    errors.introduction = `Please keep the introduction to ${limits.introduction} characters or fewer.`;
  }

  if (!values.date_of_birth) {
    errors.date_of_birth = "Please enter their date of birth.";
  } else if (!isValidDate(values.date_of_birth) || values.date_of_birth < earliestDate) {
    errors.date_of_birth = "Please check the date of birth.";
  } else if (values.date_of_birth > today) {
    errors.date_of_birth = "The date of birth can't be in the future.";
  }

  if (!values.date_of_death) {
    errors.date_of_death = "Please enter the date they died.";
  } else if (!isValidDate(values.date_of_death) || values.date_of_death < earliestDate) {
    errors.date_of_death = "Please check the date they died.";
  } else if (values.date_of_death > today) {
    errors.date_of_death = "This date can't be in the future.";
  } else if (
    !errors.date_of_birth &&
    values.date_of_death < values.date_of_birth
  ) {
    errors.date_of_death = "This date is before their date of birth. Please check both dates.";
  }

  return errors;
}

/** Empty optional answers are saved as "nothing", not as blank text. */
function toRow(values: BookFields) {
  return {
    full_name: values.full_name,
    known_as: values.known_as || null,
    date_of_birth: values.date_of_birth,
    date_of_death: values.date_of_death,
    lived_in: values.lived_in || null,
    introduction: values.introduction || null,
  };
}

async function signedInClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/login");
  }
  return supabase;
}

const problemSaving =
  "Sorry, we couldn't save the book just now. Please check your connection and try again.";

// ---------------------------------------------------------------------------

export async function createBook(_prev: BookFormState, formData: FormData): Promise<BookFormState> {
  const values = readFields(formData);
  const fieldErrors = check(values);
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return { values, fieldErrors, error: "Please check the highlighted answers." };
  }

  const supabase = await signedInClient();
  // organiser_id is filled in by the database from the signed-in organiser.
  const { error } = await supabase.from("books").insert(toRow(values));
  if (error) {
    console.error("Create book failed:", error.code, error.message);
    return { values, error: problemSaving };
  }

  revalidatePath("/my-books");
  redirect("/my-books?status=created");
}

export async function updateBook(
  bookId: string,
  _prev: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const values = readFields(formData);
  const fieldErrors = check(values);
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return { values, fieldErrors, error: "Please check the highlighted answers." };
  }
  if (!isBookId(bookId)) {
    return { values, error: "We couldn't find this book." };
  }

  const supabase = await signedInClient();
  const { data, error } = await supabase
    .from("books")
    .update(toRow(values))
    .eq("id", bookId)
    .select("id");

  if (error) {
    console.error("Update book failed:", error.code, error.message);
    return { values, error: problemSaving };
  }
  if (!data || data.length === 0) {
    // Not their book (or it no longer exists). Row Level Security blocked it.
    return { values, error: "We couldn't find this book. It may have been deleted." };
  }

  revalidatePath("/my-books");
  redirect(`/my-books/${bookId}?status=saved`);
}

export async function deleteBook(bookId: string) {
  if (!isBookId(bookId)) {
    redirect("/my-books");
  }

  const supabase = await signedInClient();
  const { error } = await supabase.from("books").delete().eq("id", bookId);
  if (error) {
    console.error("Delete book failed:", error.code, error.message);
    redirect(`/my-books/${bookId}?status=delete-failed`);
  }

  revalidatePath("/my-books");
  redirect("/my-books?status=deleted");
}
