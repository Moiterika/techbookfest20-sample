package main

import (
	"fmt"
	"net/http"

	"goth-sample/views"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		views.Page("GoTH Sample", []string{"Go", "Templ", "HTMX"}).Render(r.Context(), w)
	})

	mux.HandleFunc("POST /clicked", func(w http.ResponseWriter, r *http.Request) {
		views.Clicked().Render(r.Context(), w)
	})

	fmt.Println("Server running on http://localhost:8080")
	http.ListenAndServe(":8080", mux)
}
