document.addEventListener("DOMContentLoaded", () => {
  const todoInput = document.getElementById("todo-input");
  const addButton = document.getElementById("add-button");
  const todoList = document.getElementById("todo-list");
  const changeBgButton = document.getElementById("change-bg-button");
  const container = document.querySelector(".container");
  const changeThemeButton = document.getElementById("change-theme-button");
  const tabsContainer = document.getElementById("tabs-container");
  const addListButton = document.getElementById("add-list-button");
  const listTitle = document.getElementById("list-title");
  const searchInput = document.getElementById("search-input");
  const prioritySelect = document.getElementById("priority-select");
  const dueDateInput = document.getElementById("due-date-input");
  const backgroundCarousel = document.getElementById("background-carousel");
  const carouselGrid = document.getElementById("carousel-grid");

  let defaultBackgrounds = [
    {
      url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop",
      theme: "theme-white",
    },
    {
      url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2070&auto=format&fit=crop",
      theme: "theme-skyblue",
    },
    {
      url: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=2070&auto=format&fit=crop",
      theme: "theme-white",
    },
    {
      url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2072&auto=format&fit=crop",
      theme: "theme-black",
    },
  ];

  let state = {
    lists: {
      "To-Do": [],
    },
    finished: [],
    activeList: "To-Do",
    backgroundImageIndex: 0,
  };

  let searchQuery = "";

  // Migrate old string-based tasks to object format
  const migrateTasks = (tasks) => {
    return tasks.map((task) => {
      if (typeof task === "string") {
        return { text: task, priority: "medium", dueDate: null };
      }
      return task;
    });
  };

  const migrateFinishedTasks = (tasks) => {
    return tasks.map((item) => {
      if (typeof item === "string") {
        return { task: { text: item, priority: "medium", dueDate: null }, originalList: "Archived" };
      }
      if (item.text && !item.task) {
        return { task: item, originalList: "Archived" };
      }
      return item;
    });
  };

  const migrateState = (oldState) => {
    const newState = { ...oldState };
    Object.keys(newState.lists).forEach((listName) => {
      newState.lists[listName] = migrateTasks(newState.lists[listName]);
    });
    newState.finished = migrateFinishedTasks(newState.finished);
    return newState;
  };

  const getResizedImageUrl = (url) => {
    if (url.includes("&w=") || url.includes("?w=")) {
      return url; // Assume it's already resized
    }
    const urlParts = url.split("?");
    const newParams = "w=1920&h=1080&fit=crop&q=80";
    if (urlParts.length > 1) {
      return `${urlParts[0]}?${urlParts[1]}&${newParams}`;
    }
    return `${urlParts[0]}?${newParams}`;
  };

  const getThemeForImage = async (imageUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = imageUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        let brightness = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          brightness += r * 0.299 + g * 0.587 + b * 0.114;
        }

        brightness /= img.width * img.height;

        // Automatic theme selection based on brightness
        if (brightness < 85) {
          resolve("theme-white"); // Very dark images
        } else if (brightness > 170) {
          resolve("theme-black"); // Very light images
        } else if (brightness < 128) {
          resolve("theme-sepia"); // Mid-dark images
        } else {
          resolve("theme-skyblue"); // Mid-light images
        }
      };
      img.onerror = () => {
        resolve("theme-white"); // Default on error
      };
    });
  };

  const backgrounds = defaultBackgrounds;
  let currentImageIndex = 0;
  const themes = ["theme-white", "theme-black", "theme-skyblue", "theme-sepia"];
  let currentThemeIndex = 0;

  const saveState = () => {
    chrome.storage.sync.set({ appState: state }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving state:", chrome.runtime.lastError);
      }
    });
  };

  const applyTheme = (theme) => {
    container.classList.remove("theme-white", "theme-black", "theme-skyblue", "theme-sepia");
    container.classList.add(theme);
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString + "T00:00:00"); // Add time to avoid timezone issues
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    const diffTime = taskDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { text: `Overdue (${formattedDate})`, class: "overdue" };
    } else if (diffDays === 0) {
      return { text: "Today", class: "today" };
    } else if (diffDays === 1) {
      return { text: "Tomorrow", class: "" };
    } else {
      const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { text: formattedDate, class: "" };
    }
  };

  const render = () => {
    // Render tabs
    tabsContainer.innerHTML = "";
    Object.keys(state.lists).forEach((listName) => {
      const tab = document.createElement("div");
      tab.className = "tab";
      if (listName === state.activeList) {
        tab.classList.add("active");
      }

      const tabText = document.createElement("span");
      tabText.textContent = listName;
      tabText.className = "tab-text";

      const closeButton = document.createElement("button");
      closeButton.textContent = "×";
      closeButton.className = "tab-close";
      closeButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent tab click when clicking close
        if (confirm(`Are you sure you want to delete "${listName}"? This will remove all tasks in this list.`)) {
          delete state.lists[listName];
          // If we deleted the active list, switch to another list or "To-Do"
          if (state.activeList === listName) {
            const remainingLists = Object.keys(state.lists);
            state.activeList = remainingLists.length > 0 ? remainingLists[0] : "To-Do";
            // If no lists remain, create default "To-Do" list
            if (remainingLists.length === 0) {
              state.lists["To-Do"] = [];
              state.activeList = "To-Do";
            }
          }
          saveState();
          render();
        }
      });

      tab.appendChild(tabText);
      tab.appendChild(closeButton);

      tab.addEventListener("click", () => {
        state.activeList = listName;
        render();
      });
      tabsContainer.appendChild(tab);
    });

    // Add Finished tab
    const finishedTab = document.createElement("div");
    finishedTab.textContent = "Finished";
    finishedTab.className = "tab";
    if (state.activeList === "Finished") {
      finishedTab.classList.add("active");
    }
    finishedTab.addEventListener("click", () => {
      state.activeList = "Finished";
      render();
    });
    tabsContainer.appendChild(finishedTab);

    // Render title
    listTitle.textContent = state.activeList;

    // Render todos or finished list
    todoList.innerHTML = "";

    const isFinishedTab = state.activeList === "Finished";

    // Toggle input visibility
    const inputs = [addButton, todoInput, prioritySelect, dueDateInput, searchInput];
    inputs.forEach((input) => (input.style.display = isFinishedTab ? "none" : ""));

    if (isFinishedTab) {
      state.finished.forEach((finishedItem, index) => {
        const li = document.createElement("li");
        li.className = "finished-item";

        const contentSpan = document.createElement("span");
        contentSpan.textContent = finishedItem.task.text;

        const listBadge = document.createElement("span");
        listBadge.className = "original-list-badge";
        listBadge.textContent = `from: ${finishedItem.originalList}`;

        const restoreButton = document.createElement("button");
        restoreButton.className = "restore-btn";
        restoreButton.innerHTML = "&#8634;"; // Undo arrow
        restoreButton.title = "Restore task";
        restoreButton.addEventListener("click", () => {
          restoreTodo(index);
        });

        li.appendChild(contentSpan);
        li.appendChild(listBadge);
        li.appendChild(restoreButton);
        todoList.appendChild(li);
      });
    } else {
      let activeTodos = state.lists[state.activeList] || [];

      // Filter by search query
      if (searchQuery.trim()) {
        activeTodos = activeTodos.filter((task) => task.text.toLowerCase().includes(searchQuery.toLowerCase()));
      }

      activeTodos.forEach((task, index) => {
        const originalIndex = state.lists[state.activeList].indexOf(task);

        const li = document.createElement("li");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.addEventListener("change", () => {
          completeTodo(originalIndex);
        });

        const taskContent = document.createElement("div");
        taskContent.className = "task-content";

        const priorityBadge = document.createElement("span");
        priorityBadge.className = `priority-badge priority-${task.priority}`;
        priorityBadge.textContent = task.priority;

        const taskText = document.createElement("span");
        taskText.className = "task-text";
        taskText.textContent = task.text;
        taskText.addEventListener("dblclick", () => {
          editTask(originalIndex, li);
        });

        taskContent.appendChild(priorityBadge);
        taskContent.appendChild(taskText);

        if (task.dueDate) {
          const dateInfo = formatDate(task.dueDate);
          if (dateInfo) {
            const dueDateSpan = document.createElement("span");
            dueDateSpan.className = `due-date ${dateInfo.class}`;
            dueDateSpan.textContent = dateInfo.text;
            taskContent.appendChild(dueDateSpan);
          }
        }

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "×";
        deleteButton.classList.add("delete-btn");
        deleteButton.addEventListener("click", () => {
          removeTodo(originalIndex);
        });

        li.appendChild(checkbox);
        li.appendChild(taskContent);
        li.appendChild(deleteButton);
        todoList.appendChild(li);
      });
    }
  };

  const editTask = (index, liElement) => {
    const task = state.lists[state.activeList][index];

    liElement.classList.add("editing");
    const originalContent = liElement.innerHTML;

    liElement.innerHTML = `
        <div class="task-edit-container">
            <input type="text" class="task-edit-input" value="${task.text}">
            <select class="task-edit-priority">
                <option value="high" ${task.priority === "high" ? "selected" : ""}>High</option>
                <option value="medium" ${task.priority === "medium" ? "selected" : ""}>Medium</option>
                <option value="low" ${task.priority === "low" ? "selected" : ""}>Low</option>
            </select>
            <input type="date" class="task-edit-due-date" value="${task.dueDate || ""}">
            <button class="task-edit-save">Save</button>
            <button class="task-edit-cancel">Cancel</button>
        </div>
    `;

    const saveButton = liElement.querySelector(".task-edit-save");
    const cancelButton = liElement.querySelector(".task-edit-cancel");
    const textInput = liElement.querySelector(".task-edit-input");
    const priorityInput = liElement.querySelector(".task-edit-priority");
    const dueDateInput = liElement.querySelector(".task-edit-due-date");

    const saveEdit = () => {
      const newText = textInput.value.trim();
      if (newText) {
        state.lists[state.activeList][index] = {
          ...task,
          text: newText,
          priority: priorityInput.value,
          dueDate: dueDateInput.value || null,
        };
        saveState();
        render();
      } else {
        // If text is empty, revert
        liElement.innerHTML = originalContent;
        liElement.classList.remove("editing");
      }
    };

    saveButton.addEventListener("click", saveEdit);

    cancelButton.addEventListener("click", () => {
      liElement.innerHTML = originalContent;
      liElement.classList.remove("editing");
      // We need to re-attach the event listener after reverting innerHTML
      render();
    });

    textInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") saveEdit();
    });
  };

  const completeTodo = (index) => {
    const task = state.lists[state.activeList][index];
    state.finished.unshift({ task: task, originalList: state.activeList });
    state.lists[state.activeList].splice(index, 1);
    saveState();
    render();
  };

  const restoreTodo = (index) => {
    const finishedItem = state.finished[index];
    const { task, originalList } = finishedItem;

    if (!state.lists[originalList]) {
      state.lists[originalList] = [];
    }

    state.lists[originalList].push(task);
    state.finished.splice(index, 1);

    saveState();
    render();
  };

  // Load state from storage
  chrome.storage.sync.get(["appState"], (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error loading state:", chrome.runtime.lastError);
      // Fallback to local storage if sync is unavailable
      chrome.storage.local.get(["appState"], (localResult) => {
        if (localResult.appState) {
          state = migrateState(localResult.appState);
        }
        initialize();
      });
      return;
    }

    if (result.appState) {
      state = migrateState(result.appState);
    }
    initialize();
  });

  const initialize = () => {
    // Set background and theme from loaded state
    currentImageIndex = state.backgroundImageIndex || 0;
    if (currentImageIndex >= backgrounds.length) {
      currentImageIndex = 0;
      state.backgroundImageIndex = 0;
    }
    const background = backgrounds[currentImageIndex];
    document.body.style.backgroundImage = `url('${getResizedImageUrl(background.url)}')`;
    applyTheme(background.theme);
    currentThemeIndex = themes.indexOf(background.theme);
    render();
  };

  const saveBackgroundImage = () => {
    state.backgroundImageIndex = currentImageIndex;
    saveState();
  };

  const addTodo = () => {
    const todoText = todoInput.value.trim();
    if (todoText !== "" && state.activeList !== "Finished") {
      if (!state.lists[state.activeList]) {
        state.lists[state.activeList] = [];
      }
      const priority = prioritySelect.value;
      const dueDate = dueDateInput.value || null;
      state.lists[state.activeList].push({ text: todoText, priority, dueDate });
      todoInput.value = "";
      dueDateInput.value = "";
      prioritySelect.value = "medium";
      saveState();
      render();
    }
  };

  const removeTodo = (index) => {
    if (state.activeList !== "Finished") {
      state.lists[state.activeList].splice(index, 1);
      saveState();
      render();
    }
  };

  addListButton.addEventListener("click", () => {
    const newListName = prompt("Enter the name for the new list:");
    if (newListName && !state.lists[newListName]) {
      state.lists[newListName] = [];
      state.activeList = newListName;
      saveState();
      render();
    } else if (newListName) {
      alert("A list with this name already exists.");
    }
  });

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    render();
  });

  addButton.addEventListener("click", addTodo);
  todoInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addTodo();
    }
  });

  changeBgButton.addEventListener("click", () => {
    populateCarousel();
    backgroundCarousel.classList.remove("hidden");
  });

  backgroundCarousel.addEventListener("click", (e) => {
    // Close if clicking on the background overlay
    if (e.target === backgroundCarousel) {
      backgroundCarousel.classList.add("hidden");
    }
  });

  const populateCarousel = () => {
    carouselGrid.innerHTML = "";
    backgrounds.forEach((bg, index) => {
      const item = document.createElement("div");
      item.className = "carousel-item";

      const thumb = document.createElement("img");
      thumb.className = "carousel-thumbnail";
      thumb.src = getResizedImageUrl(bg.url).replace("w=1920&h=1080", "w=300&h=200");
      thumb.addEventListener("click", async () => {
        currentImageIndex = index;
        const newBackground = backgrounds[currentImageIndex];
        const theme = await getThemeForImage(thumb.src);

        document.body.style.backgroundImage = `url('${getResizedImageUrl(newBackground.url)}')`;
        applyTheme(theme);
        currentThemeIndex = themes.indexOf(theme);
        state.backgroundImageIndex = currentImageIndex;
        saveState();
        backgroundCarousel.classList.add("hidden");
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "carousel-delete-btn";
      deleteBtn.innerHTML = "&times;";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteBackground(index);
      });

      item.appendChild(thumb);
      item.appendChild(deleteBtn);
      carouselGrid.appendChild(item);
    });

    // Add the "Add Image" card
    const addCard = document.createElement("div");
    addCard.className = "add-image-card";
    addCard.innerHTML = "<span>+</span>";
    addCard.addEventListener("click", addNewBackground);
    carouselGrid.appendChild(addCard);

    // Add the "Plain Color" card
    const colorCard = document.createElement("div");
    colorCard.className = "color-picker-card";
    colorCard.innerHTML = "<span>Custom Solid<br>Colors</span>";
    colorCard.addEventListener("click", showColorPalette);
    carouselGrid.appendChild(colorCard);
  };

  const addNewBackground = () => {
    const url = prompt("Please enter the Unsplash image URL:");
    if (url && url.startsWith("https://images.unsplash.com/")) {
      const resizedUrl = getResizedImageUrl(url);
      getThemeForImage(resizedUrl.replace("w=1920&h=1080", "w=300&h=200")).then((theme) => {
        backgrounds.push({ url: resizedUrl, theme: theme });
        saveState();
        populateCarousel();
      });
    } else if (url) {
      alert("Invalid URL. Please use a valid Unsplash image URL.");
    }
  };

  const showColorPalette = () => {
    const palette = document.createElement("div");
    palette.className = "color-palette";
    palette.style.display = "flex";

    const colors = ["#f4f4f9", "#2c3e50", "#8e44ad", "#2980b9", "#16a085", "#d35400"];
    colors.forEach((color) => {
      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = color;
      swatch.addEventListener("click", () => {
        document.body.style.backgroundImage = "none";
        document.body.style.backgroundColor = color;
        // A simple logic to choose a contrasting theme
        const isDark =
          parseInt(color.substr(1, 2), 16) * 0.299 +
            parseInt(color.substr(3, 2), 16) * 0.587 +
            parseInt(color.substr(5, 2), 16) * 0.114 <
          186;
        const theme = isDark ? "theme-white" : "theme-black";
        applyTheme(theme);
        backgroundCarousel.classList.add("hidden");
        palette.remove();
      });
      palette.appendChild(swatch);
    });

    backgroundCarousel.appendChild(palette);

    // Close palette when clicking outside
    setTimeout(() => {
      const clickOutside = (e) => {
        if (!palette.contains(e.target)) {
          palette.remove();
          document.removeEventListener("click", clickOutside);
        }
      };
      document.addEventListener("click", clickOutside);
    }, 0);
  };

  const deleteBackground = (index) => {
    backgrounds.splice(index, 1);

    if (currentImageIndex === index) {
      currentImageIndex = 0;
      state.backgroundImageIndex = 0;
      if (backgrounds.length > 0) {
        const newBackground = backgrounds[0];
        document.body.style.backgroundImage = `url('${getResizedImageUrl(newBackground.url)}')`;
        applyTheme(newBackground.theme);
      } else {
        document.body.style.backgroundImage = "none";
        document.body.style.backgroundColor = "#f4f4f9";
        applyTheme("theme-white"); // Apply a default theme
      }
    } else if (currentImageIndex > index) {
      currentImageIndex--;
      state.backgroundImageIndex = currentImageIndex;
    }

    saveState();
    populateCarousel();
  };

  changeThemeButton.addEventListener("click", () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    const newTheme = themes[currentThemeIndex];
    applyTheme(newTheme);
  });
});
