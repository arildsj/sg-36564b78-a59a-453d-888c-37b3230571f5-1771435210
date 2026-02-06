import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageProvider";

const languageFlags = {
  no: "🇳🇴",
  en: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
};

const languageNames = {
  no: "Norsk",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
};

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" title="Change language">
          <span className="text-2xl">{languageFlags[language]}</span>
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLanguage("no")}>
          <span className="mr-2 text-xl">{languageFlags.no}</span>
          {languageNames.no}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage("en")}>
          <span className="mr-2 text-xl">{languageFlags.en}</span>
          {languageNames.en}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage("de")}>
          <span className="mr-2 text-xl">{languageFlags.de}</span>
          {languageNames.de}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage("fr")}>
          <span className="mr-2 text-xl">{languageFlags.fr}</span>
          {languageNames.fr}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage("es")}>
          <span className="mr-2 text-xl">{languageFlags.es}</span>
          {languageNames.es}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage("it")}>
          <span className="mr-2 text-xl">{languageFlags.it}</span>
          {languageNames.it}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}